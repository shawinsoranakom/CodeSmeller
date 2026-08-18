const electron = require("electron")
const ipc = electron.ipcRenderer
const fs = require("fs")

const input = document.getElementById("pythonCode");
const pyFile = document.getElementById("uploadPyFile");
const beginBtn = document.getElementById("detectBtn");
const clearBtn = document.getElementById("clearCodeBtn");
const resultTemplate = document.getElementById("resTemplate");
const resultList = document.getElementById("detectResult")

const editor = CodeMirror.fromTextArea(input, {
    mode: "python", 
    theme: "dracula",
    lineNumbers: true,
    indentUnit: 4,
    tabSize: 4,
    indentWithTabs: false
})

function readPy(file) {
    const reader = new FileReader();
    
    reader.onload = function(e) {
        let pyCode = e.target.result;
        // Move the UI update inside the onload event where the data exists
        editor.setValue(pyCode);
    };

    reader.readAsText(file);
}

function extractPythonMethods(pythonCode) {
    const methods = [];
    const lines = pythonCode.split('\n');

    // 1. First pass: Find all class definitions and their indentation + line ranges
    const classRegex = /^([ \t]*)class\s+([a-zA-Z_][a-zA-Z0-9_]*)/gm;
    const classes = [];
    let classMatch;

    while ((classMatch = classRegex.exec(pythonCode)) !== null) {
        const indentLevel = classMatch[1].length;
        const className = classMatch[2];
        const lineIndex = pythonCode.substring(0, classMatch.index).split('\n').length - 1;

        classes.push({
            name: className,
            indent: indentLevel,
            startLine: lineIndex + 1
        });
    }

    // Helper: Determine which class a method belongs to based on line number & indent level
    function getEnclosingClass(methodIndent, methodLineIndex) {
        for (let i = classes.length - 1; i >= 0; i--) {
            const cls = classes[i];
            // Method must be after class declaration and more indented than class header
            if (methodLineIndex >= cls.startLine && methodIndent > cls.indent) {
                return cls.name;
            }
        }
        return null; // Standalone function
    }

    // 2. Second pass: Find all method definitions
    const methodHeaderRegex = /^([ \t]*)def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(([^)]*)\)\s*(?:->\s*[^:]+)?\s*:/gm;
    let methodMatch;

    while ((methodMatch = methodHeaderRegex.exec(pythonCode)) !== null) {
        const indentLevel = methodMatch[1].length;
        const methodName = methodMatch[2];
        const params = methodMatch[3].trim();
        
        // 1-based start line index
        const lineOffset = pythonCode.substring(0, methodMatch.index).split('\n').length - 1;
        const startLine = lineOffset + 1;
        
        let bodyLines = [lines[lineOffset]];
        let i = lineOffset + 1;

        while (i < lines.length) {
            const line = lines[i];
            const trimmed = line.trim();

            if (trimmed === '' || trimmed.startsWith('#')) {
                bodyLines.push(line);
                i++;
                continue;
            }

            const currentIndent = line.search(/\S/);

            // Stop when indentation returns to or drops below method header level
            if (currentIndent <= indentLevel) {
                break;
            }

            bodyLines.push(line);
            i++;
        }

        const endLine = lineOffset + bodyLines.length;
        const fullBody = bodyLines.join('\n');
        
        // Extract docstring
        const docstringMatch = fullBody.match(/^(?:[ \t]*def[\s\S]*?:\n)[ \t]*(?:"""|''')([\s\S]*?)(?:"""|''')/);
        const docstring = docstringMatch ? docstringMatch[1].trim() : null;

        // Detect enclosing class
        const className = getEnclosingClass(indentLevel, startLine);

        methods.push({
            name: methodName,
            className: className, // String name or null for standalone functions
            params: params,
            startLine: startLine,
            endLine: endLine,
            docstring: docstring,
            body: fullBody
        });
    }

    return methods;
}

pyFile.addEventListener("change", function(event) {
    const fileList = event.target.files;

    if(fileList.length > 0) {
        let selectedFile = fileList[0];
        readPy(selectedFile); // Just run the function, don't assign it
    }
});


beginBtn.addEventListener("click", async function() {
    const pyCode = editor.getValue();
    
    let methodList = extractPythonMethods(pyCode);
    const detectResult = await ipc.invoke("DetectCodeSmell", methodList);

    // Clear previous results
    const resultList = document.getElementById("detectResult");
    
    // Remove old cloned elements while preserving the <template>
    const template = document.getElementById("resTemplate");
    resultList.innerHTML = "";
    resultList.appendChild(template);

    detectResult.forEach((result, i) => {
        const clone = template.content.cloneNode(true);

        const button = clone.querySelector("#methodDropdown");
        const collapseDiv = clone.querySelector("#result");
        const complexText = clone.querySelector("#complexMethod");

        // 1. Assign unique IDs for this specific item
        const collapseId = `result-collapse-${i}`;
        const buttonId = `methodDropdown-${i}`;

        button.id = buttonId;
        collapseDiv.id = collapseId;

        // 2. Link the Bootstrap triggers to the new unique ID
        button.setAttribute("data-bs-target", `#${collapseId}`);
        button.setAttribute("aria-controls", collapseId);

        // 3. Populate content
        button.textContent = result["method"]["name"];
        let num = (result["result"][1] ?? 0) * 100
        complexText.textContent = "Complex Method: " + String(num.toFixed(2)) + "%";

        resultList.appendChild(clone);
    });
});

clearBtn.addEventListener("click", function() {
    editor.setValue("");
    editor.clearHistory();
    resultList.replaceChildren(resultTemplate);

    pyFile.value = "";
})
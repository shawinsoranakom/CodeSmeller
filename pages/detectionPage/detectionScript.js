const electron = require("electron")
const ipc = electron.ipcRenderer
const fs = require("fs")

const input = document.getElementById("pythonCode");
const pyFile = document.getElementById("uploadPyFile")
const beginBtn = document.getElementById("detectBtn");
const clearBtn = document.getElementById("clearCodeBtn")

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

pyFile.addEventListener("change", function(event) {
    const fileList = event.target.files;

    if(fileList.length > 0) {
        let selectedFile = fileList[0];
        readPy(selectedFile); // Just run the function, don't assign it
    }
});


beginBtn.addEventListener("click", function() {
    const pyCode = editor.getValue();

    ipc.invoke("DetectCodeSmell", pyCode)
})

clearBtn.addEventListener("click", function() {
    editor.setValue("");
    editor.clearHistory();

    pyFile.value = "";
})
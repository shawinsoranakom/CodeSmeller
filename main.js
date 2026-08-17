const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const url = require("url");

const ort = require("onnxruntime-node");

let win;

function createWindow() {
    win = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile("./pages/detectionPage/detectionPage.html");
}
let tokenizer;
let session;

async function loadModelAndTokenizer() {
    try {
        const { AutoTokenizer, env } = await import('@xenova/transformers');

        env.localModelPath = path.resolve(__dirname); 
        env.allowLocalModels = true;
        env.allowRemoteModels = false;

        // 1. Load tokenizer
        tokenizer = await AutoTokenizer.from_pretrained('Model');

        // 🛠️ FIX: Manually define special token IDs if they are undefined
        if (tokenizer.pad_token_id === undefined) tokenizer.pad_token_id = 1;
        if (tokenizer.eos_token_id === undefined) tokenizer.eos_token_id = 2;
        if (tokenizer.bos_token_id === undefined) tokenizer.bos_token_id = 0;

        console.log('Tokenizer Loaded Successfully!');

        // 2. Load ONNX Session
        const modelFilePath = path.join(__dirname, 'Model', 'model.onnx');
        session = await ort.InferenceSession.create(modelFilePath, {
        executionProviders: ['cpu'],
        });
        console.log('ONNX Model Loaded Successfully!');

    } catch (err) {
        console.error('Failed to load tokenizer or model:', err);
    }
}

ipcMain.handle('DetectCodeSmell', async (event, pyCode) => {
    if (!session || !tokenizer) {
        throw new Error('Model or Tokenizer not loaded yet.');
    }

    // Ensure input is a valid string
    const textInput = String(pyCode || '').trim();
    if (!textInput) return [];

    // 1. Tokenize with padding enabled
    const encoded = await tokenizer(textInput, {
        padding: true,
        truncation: true,
        max_length: 512,
    });

    // 2. Extract input tensors
    const inputIds = BigInt64Array.from(encoded.input_ids.data);
    const attentionMask = BigInt64Array.from(encoded.attention_mask.data);
    const seqLength = encoded.input_ids.dims[1];

    // 3. Create ONNX Tensors
    const feeds = {
        input_ids: new ort.Tensor('int64', inputIds, [1, seqLength]),
        attention_mask: new ort.Tensor('int64', attentionMask, [1, seqLength]),
    };

    // 4. Run model inference
    const results = await session.run(feeds);

    // 5. Return outputs
    const outputName = Object.keys(results)[0];

    console.log(Array.from(results[outputName].data));
});

app.whenReady().then(async () => {
  await loadModelAndTokenizer();
  createWindow();
});
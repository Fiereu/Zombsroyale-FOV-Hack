/*
    Much of this code is just stolen from Cetus u can find it here: https://github.com/Qwokka/Cetus/
*/

const ab = new ArrayBuffer(8);
const u8 = new Uint8Array(ab);
const f32 = new Float32Array(ab);
const i32 = new Int32Array(ab);

class Brecher{
    constructor(data) {
        this._Binary = data["Binary"];
        this._MemoryObject = data["Memory"];
        this._Memory = new Uint8Array(data["Memory"].buffer);
        this._Symbols = data["Symbols"];
        this._InstanceObject = data["InstanceObject"];
        this._ImportObject = data["ImportObject"];
    }

    // memory manipulation
    readBool(ptr) {
        u8[0] = this._Memory[ptr + 0];
        u8[1] = this._Memory[ptr + 1];
        u8[2] = this._Memory[ptr + 2];
        u8[3] = this._Memory[ptr + 3];
        let b = i32[0];
        return !!b;
    }
    
    readF32(ptr) {
        u8[0] = this._Memory[ptr + 0];
        u8[1] = this._Memory[ptr + 1];
        u8[2] = this._Memory[ptr + 2];
        u8[3] = this._Memory[ptr + 3];
        return f32[0];
    }
    
    readU8(ptr) {
        return this._Memory[ptr];
    }
    
    readI32(ptr) {
        u8[0] = this._Memory[ptr + 0];
        u8[1] = this._Memory[ptr + 1];
        u8[2] = this._Memory[ptr + 2];
        u8[3] = this._Memory[ptr + 3];
        return i32[0];
    }
    
    writeF32(ptr, value) {
        let af32 = new Float32Array(1);
        af32[0] = value;
        let au8 = new Uint8Array(af32.buffer)
        this._Memory[ptr + 0] = au8[0];
        this._Memory[ptr + 1] = au8[1];
        this._Memory[ptr + 2] = au8[2];
        this._Memory[ptr + 3] = au8[3];
    }

    writeU8(ptr, value) {
        let af32 = new Float32Array(1);
        af32[0] = value;
        let au8 = new Uint8Array(af32.buffer)
        this._Memory[ptr + 0] = au8[0];
        this._Memory[ptr + 1] = au8[1];
        this._Memory[ptr + 2] = au8[2];
        this._Memory[ptr + 3] = au8[3];
    }

    writeI32(ptr, value) {
        let ai8 = new Int8Array(1);
        ai8[0] = value;
        let au8 = new Uint8Array(ai8.buffer)
        this._Memory[ptr] = au8[0];
    }



    // WASM
    static GetCaller() {
        const functionRegex = /wasm-function\[[0-9]*\]/gm
    
        const stackFrames = StackTrace.getSync();
        for(let i = 0; i < stackFrames.length; i++) {
            const frame = stackFrames[i];
            
            if(frame["fileName"].startsWith("wasm://")) {
                let m;
    
                while ((m = functionRegex.exec(frame["fileName"])) !== null) {
    
                    if (m.index === functionRegex.lastIndex) {
                        functionRegex.lastIndex++;
                    }
                    
                    return m[0];
                }
                return "unknown"
            }
        }
    }
}

// callbacks need to be hooked
let brecher = {};
let instrumentBinary = function(binary) {
    
    console.log("instrumentBinary not implemented will be skipped.")
    const wail = new WailParser(binary);

    let memoryInstancePath;
    const importEntryCallback = function (parameters) {
        if (parameters.kind == KIND_MEMORY) {
            const decoder = new TextDecoder();

            if (typeof memoryInstancePath !== "undefined") {
                console.log("Received multiple memory entries. This is unsupported by Cetus!");
            }

            memoryInstancePath = {};

            memoryInstancePath.type = "import";
            memoryInstancePath.module = decoder.decode(parameters.module);
            memoryInstancePath.field = decoder.decode(parameters.field);
        }
    }

    wail.addImportElementParser(null, importEntryCallback);

    const exportEntryCallback = function (parameters) {
        if (parameters.kind == KIND_MEMORY) {
            const decoder = new TextDecoder();

            if (typeof memoryInstancePath !== "undefined") {
                console.log("Received multiple memory entries. This is unsupported by Cetus!");
            }

            memoryInstancePath = {};

            memoryInstancePath.type = "export";
            memoryInstancePath.field = decoder.decode(parameters.field);
        }
    }

    wail.addExportElementParser(null, exportEntryCallback);

    wail.load(binary);
    wail.parse();

    const symObj = {};

    const resultObj = {};

    resultObj.buffer = wail.write();

    resultObj.symbols = symObj;
    resultObj.memory = memoryInstancePath;

    return resultObj;
}

let importHook = function(importObject) {
    return importObject;
}

// Stolen from Cetus
const oldWebAssemblyInstantiate = WebAssembly.instantiate;
const oldWebAssemblyInstantiateStreaming = WebAssembly.instantiateStreaming;
const webAssemblyInstantiateStreamingHook = function (sourceObj, importObject = {}) {

    console.log("Intercepted WebAssembly.instantiateStreaming()")

    let memoryInstance = null;

    // correct Emscript version difference
    if (typeof importObject.a !== "undefined" && typeof importObject.env === "undefined") {
        importObject.env = importObject.a;
    }

    // create importObject.env if undefined
    if (typeof importObject.env === "undefined") {
        importObject.env = {};
    }

    // register imports
    importObject = importHook(importObject);

    return new Promise(function (resolve, reject) {
        const getMemoryFromObject = function (inObject, memoryDescriptor) {
            const memoryModule = memoryDescriptor.module;
            const memoryField = memoryDescriptor.field;

            if (typeof memoryModule === "string" && typeof memoryField === "string") {
                return inObject[memoryModule][memoryField];
            }
            else if (typeof memoryField === "string") {
                return inObject[memoryField];
            }
        };
        const handleBuffer = function (bufferSource) {
            // patching binary here
            const instrumentResults = instrumentBinary(bufferSource);

            const instrumentedBuffer = instrumentResults.buffer;
            const instrumentedSymbols = instrumentResults.symbols;

            const memoryDescriptor = instrumentResults.memory;

            if (typeof memoryDescriptor !== "undefined" && memoryDescriptor.type === "import") {
                memoryInstance = getMemoryFromObject(importObject, memoryDescriptor);
            }

            oldWebAssemblyInstantiate(instrumentedBuffer, importObject).then(function (instanceObject) {
                if (typeof memoryDescriptor !== "undefined" && memoryDescriptor.type === "export") {
                    memoryInstance = getMemoryFromObject(instanceObject.instance.exports, memoryDescriptor);
                }

                if (!(memoryInstance instanceof WebAssembly.Memory)) {
                    console.log("WebAssembly.instantiateStreaming() failed to retrieve a WebAssembly.Memory object");
                }
                
                brecher = new Brecher({
                    Binary: instrumentBinary,
                    Memory: memoryInstance,
                    Symbols: instrumentedSymbols,
                    InstanceObject: instanceObject,
                    ImportObject: importObject,
                });

                resolve(instanceObject);
            });
        }

        if (sourceObj instanceof Promise) {
            sourceObj.then((res) => res.arrayBuffer()).then((bufferSource) => {
                handleBuffer(bufferSource);
            });
        }
        else if (sourceObj instanceof Response) {
            sourceObj.arrayBuffer().then((bufferSource) => {
                handleBuffer(bufferSource);
            });
        }
        else {
            console.log("Got unexpected object type as first argument to WebAssembly.instantiateStreaming");
        }
    });
}
WebAssembly.instantiateStreaming = webAssemblyInstantiateStreamingHook;

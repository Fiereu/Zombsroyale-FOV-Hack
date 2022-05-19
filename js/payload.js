console.log("Running payload")

// addresses
const Offsets = {
    Zoom: 0x07494718,
    InventorySlot: 0x063f0590,
}

let toggle = false;
const StoreI32Callback = function (a1, a2) {
    a1 += 24; // correct offset


    if (a1 == Offsets["InventorySlot"]) {
        //console.log(`Wrote ${a2} to ${a1} from ${Brecher.GetCaller()}`)
        //return 0;
    }

    return 1;
}

const StoreF32Callback = function (a1, a2) {
    a1 += 24; // correct offset

    if (a1 == Offsets["Zoom"]) {

        // Trigger when in plane
        if (a2 == 2.5 && !toggle) {
            toggle = true;
            return 1;
        }

        //console.log(`Wrote ${a2} to ${a1} from ${Brecher.GetCaller()}`)
        if (toggle)
            return 0;
    }

    return 1;
}

const SetPlayerPosHook = function (stacktop, a1, a2) {
    console.log(`Updated Player pos`);
}

importHook = function (importObject) {

    importObject.env.StoreI32Callback = StoreI32Callback;
    importObject.env.StoreF32Callback = StoreF32Callback;
    importObject.env.SetPlayerPosHook = SetPlayerPosHook;

    return importObject;
}

// patching Binary here
instrumentBinary = function (binary) {
    console.log("Patching binary")
    const wail = new WailParser();

    // function entries
    const STORE_I32_Hook_TypeEntry = wail.addTypeEntry({
        form: "func",
        params: ["i32", "i32"],
        returnType: "i32"
    })
    const STORE_F32_Hook_TypeEntry = wail.addTypeEntry({
        form: "func",
        params: ["i32", "f32"],
        returnType: "i32"
    })
    const SetPlayerPosHook_TypeEntry = wail.addTypeEntry({
        form: "func",
        params: ["i32", "f32"],
    })

    // imports
    const STORE_I32_Hook_ImportEntry = wail.addImportEntry({
        moduleStr: "env",
        fieldStr: "StoreI32Callback",
        kind: "func",
        type: STORE_I32_Hook_TypeEntry
    });
    const STORE_F32_Hook_ImportEntry = wail.addImportEntry({
        moduleStr: "env",
        fieldStr: "StoreF32Callback",
        kind: "func",
        type: STORE_F32_Hook_TypeEntry
    });
    const SetPlayerPosHook_ImportEntry = wail.addImportEntry({
        moduleStr: "env",
        fieldStr: "SetPlayerPosHook",
        kind: "func",
        type: SetPlayerPosHook_TypeEntry
    });

    // globals
    const TempStoreAddress_i32 = wail.addGlobalEntry({
        globalType: {
            contentType: "i32",
            mutability: true,
        },
        initExpr: [OP_I32_CONST, VarUint32(0x00), OP_END]
    });

    const TempStoreValue_i32 = wail.addGlobalEntry({
        globalType: {
            contentType: "i32",
            mutability: true,
        },
        initExpr: [OP_I32_CONST, VarUint32(0x00), OP_END]
    });

    const TempStoreValue_f32 = wail.addGlobalEntry({
        globalType: {
            contentType: "f32",
            mutability: true,
        },
        initExpr: [OP_F32_CONST, 0x00, 0x00, 0x00, 0x00, OP_END]
    });

    // functions

    // code

    // Opcode Parsers
    const STORE_I32_Parser = function (org_opcode) {
        const reader = new BufferReader(org_opcode);

        const SaveArgumentsI32 = [
            OP_SET_GLOBAL, TempStoreValue_i32.varUint32(),
            OP_SET_GLOBAL, TempStoreAddress_i32.varUint32(),
        ];
        const RestoreArgumentsI32 = [
            OP_GET_GLOBAL, TempStoreAddress_i32.varUint32(),
            OP_GET_GLOBAL, TempStoreValue_i32.varUint32(),
        ];
        const checkReturn = [
            //OP_I32_CONST, VarUint32(0x00),
            //OP_I32_EQ,
            OP_IF, 0x40
        ];
        const end = [OP_END];
        const callOpcode = [OP_CALL];
        const callDest = STORE_I32_Hook_ImportEntry.varUint32();

        reader.copyBuffer(SaveArgumentsI32);
        reader.copyBuffer(RestoreArgumentsI32);
        reader.copyBuffer(callOpcode);
        reader.copyBuffer(callDest);
        reader.copyBuffer(checkReturn);
        reader.copyBuffer(RestoreArgumentsI32);
        reader.copyBuffer(org_opcode);
        reader.copyBuffer(end);

        return reader.write();
    }

    const STORE_F32_Parser = function (org_opcode) {
        const reader = new BufferReader(org_opcode);

        const SaveArgumentsF32 = [
            OP_SET_GLOBAL, TempStoreValue_f32.varUint32(),
            OP_SET_GLOBAL, TempStoreAddress_i32.varUint32(),
        ];
        const RestoreArgumentsF32 = [
            OP_GET_GLOBAL, TempStoreAddress_i32.varUint32(),
            OP_GET_GLOBAL, TempStoreValue_f32.varUint32(),
        ];
        const checkReturn = [
            //OP_I32_CONST, VarUint32(0x00),
            //OP_I32_EQ,
            OP_IF, 0x40
        ];
        const end = [OP_END];
        const callOpcode = [OP_CALL];
        const callDest = STORE_F32_Hook_ImportEntry.varUint32();

        reader.copyBuffer(SaveArgumentsF32);
        reader.copyBuffer(RestoreArgumentsF32);
        reader.copyBuffer(callOpcode);
        reader.copyBuffer(callDest);
        reader.copyBuffer(checkReturn);
        reader.copyBuffer(RestoreArgumentsF32);
        reader.copyBuffer(org_opcode);
        reader.copyBuffer(end);

        return reader.write();
    }

    const SetPlayerPos = wail.getFunctionIndex(13268);
    const CALL_Parser = function (org_opcode) {
        const reader = new BufferReader(org_opcode);

        const opcode = reader.readUint8();
        const callTarget = reader.readVarUint32();

        if (callTarget == SetPlayerPos.i32()) {
            const SaveArgumentsI32 = [
                OP_SET_GLOBAL, TempStoreValue_i32.varUint32(),
                OP_SET_GLOBAL, TempStoreAddress_i32.varUint32(),
            ];
            const RestoreArgumentsI32 = [
                OP_GET_GLOBAL, TempStoreAddress_i32.varUint32(),
                OP_GET_GLOBAL, TempStoreValue_i32.varUint32(),
            ];
            const getStackTop = [OP_GET_GLOBAL, VarUint32(7)];
            const callOpcode = [OP_CALL];
            const callDest = SetPlayerPosHook_ImportEntry.varUint32();
            
            reader.copyBuffer(SaveArgumentsI32);
            reader.copyBuffer(getStackTop);
            reader.copyBuffer(RestoreArgumentsI32);
            reader.copyBuffer(callOpcode);
            reader.copyBuffer(callDest);
            reader.copyBuffer(RestoreArgumentsI32);
            reader.copyBuffer(org_opcode);

            return reader.write();
        }

        return org_opcode;
    }

    // using custome parsers
    wail.addInstructionParser(OP_I32_STORE, STORE_I32_Parser);
    wail.addInstructionParser(OP_F32_STORE, STORE_F32_Parser);
    // wail.addInstructionParser(OP_CALL, CALL_Parser);


    // stolen from cetus
    let memoryInstancePath;

    // We use this callback to retrieve the path to the memory object
    // If multiple memory objects are supported in the future, this will need to change
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
// Mock NfcManager for web to prevent bundler crashes
const NfcManager = {
    start: async () => { },
    cancelTechnologyRequest: async () => { },
    isSupported: async () => false,
    requestTechnology: async () => { },
    getTag: async () => null,
    writeNdefMessage: async () => { },
    NfcTech: { Ndef: 'Ndef' },
};

const Ndef = {
    text: {
        decodePayload: () => '',
    },
    encodeMessage: () => [],
    textRecord: () => { },
};

const NfcTech = { Ndef: 'Ndef' };

export { NfcManager as default, Ndef, NfcTech };

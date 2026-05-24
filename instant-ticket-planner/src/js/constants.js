export const FEATURES_CSV_DATA = `"Generic Feature","SG Brand Name","PB Brand Name","BS Brand Name","SG (Y/N)","PB (Y/N)","BS (Y/N)"
"Holographic Foil","HoloFoil™","Scratch FX® Holographic","Holographic Substrate","Y","Y","Y"
"Sparkle/Glitter Coating","Glitter Ink","Sparkle®","Metallic Sparkle","Y","Y","N"
"Scented Ink","Scent™","Scratch & Sniff®","Aroma Ink","Y","Y","Y"
"Metallic Ink","Metallic Inks","Metallic Inks","Metallic FX","Y","Y","Y"
"Die-Cut Ticket","Custom Die-Cut","Die-Cut","Custom Shape","Y","Y","Y"
"Oversized Format","Jumbo Ticket","Big Ticket™","Oversized Format","Y","Y","Y"
"Extended Play (Crossword/Bingo)","Extended Play","Crossword/Bingo","Extended Play","Y","Y","Y"
"Licensed Property Usage","Licensed Brands","Licensed Portfolio","","Y","Y","N"
"Recycled Substrate","Eco-Stock","Recycled Content Paper","","Y","Y","N"
"Secure Barcoding","Secure Code™","SecureValidate™","Secure Barcode","Y","Y","Y"`;

export const CONTRACT_UNIT_PRESETS = {
    1: [12000000, 18000000, 24000000],
    2: [12000000, 18000000, 24000000],
    3: [12000000, 18000000, 24000000],
    5: [12000000, 18000000, 24000000],
    10: [12000000, 18000000],
    20: [12000000],
    30: [12000000],
    default: [10000000]
};

export const STANDARD_DENOMINATIONS = [1, 2, 3, 5, 10, 20, 25, 30, 50];

export const STANDARD_TICKET_SIZES = [
    { id: '2.4x4', label: '2.4" x 4"' },
    { id: '4x4', label: '4" x 4"' },
    { id: '6x4', label: '6" x 4"' },
    { id: '8x4', label: '8" x 4"' },
    { id: '12x8', label: '12" x 8"' },
    { id: '12x12', label: '12" x 12"' }
];

export const DEFAULT_TICKET_SIZE_FOR_DENOM = {
    1: '2.4x4',
    2: '4x4',
    3: '4x4',
    5: '6x4',
    10: '8x4',
    20: '8x4',
    25: '8x4',
    30: '8x4',
    50: '12x8',
    default: '4x4'
};

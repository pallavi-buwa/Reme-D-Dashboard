/* eslint-disable no-console */

const { initDatabase, seedProductionData, get } = require('../database');

function parseArgs(argv) {
    const args = { multiplier: 10, minTargetComplaints: 100, seed: undefined };
    for (let i = 2; i < argv.length; i++) {
        const a = argv[i];
        const next = argv[i + 1];
        if (a === '--multiplier' && next) {
            args.multiplier = Number(next);
            i++;
        } else if (a === '--min' && next) {
            args.minTargetComplaints = Number(next);
            i++;
        } else if (a === '--seed' && next) {
            args.seed = Number(next);
            i++;
        }
    }
    return args;
}

function main() {
    const opts = parseArgs(process.argv);

    initDatabase();

    const before = {
        complaints: get('SELECT COUNT(*) as c FROM complaints').c,
        section_responses: get('SELECT COUNT(*) as c FROM section_responses').c,
        status_history: get('SELECT COUNT(*) as c FROM status_history').c,
        internal_notes: get('SELECT COUNT(*) as c FROM internal_notes').c,
    };

    const result = seedProductionData(opts);

    const after = {
        complaints: get('SELECT COUNT(*) as c FROM complaints').c,
        section_responses: get('SELECT COUNT(*) as c FROM section_responses').c,
        status_history: get('SELECT COUNT(*) as c FROM status_history').c,
        internal_notes: get('SELECT COUNT(*) as c FROM internal_notes').c,
    };

    console.log('\nSeed production data complete');
    console.log('Options:', opts);
    console.log('Result:', result);
    console.log('Before:', before);
    console.log('After :', after);
    console.log('');
}

main();

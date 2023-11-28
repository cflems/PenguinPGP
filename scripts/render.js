/* BEGIN USER-CONFIGURABLE */
const VERIFIED_COLOR = "#008000";
const UNVERIFIED_COLOR = "#800000";
const MIXED_COLOR = "#808000";
const UNSIGNED_COLOR = null;
/* END USER-CONFIGURABLE */

const SHARED_BEGIN = '-----BEGIN PGP ';
const BEGIN_MESSAGE = '-----BEGIN PGP MESSAGE-----';
const END_MESSAGE = '-----END PGP MESSAGE-----';
const BEGIN_SIG = '-----BEGIN PGP SIGNED MESSAGE-----';
const END_SIG = '-----END PGP SIGNATURE-----';

async function render () {
    const pubring = await load_pubkeys();
    const privring = await load_privkeys();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let in_message = false;
    let in_signature = false;
    let chunks = [];

    while (node = walker.nextNode()) {
        let input = node.textContent.trim();
        let can_own = true;

        while (input.length > 0) {
            let idx;
            if (in_message) {
                if ((idx = input.indexOf(END_MESSAGE)) !== -1) {
                    chunks.push({
                        node: node,
                        text: input.substring(0, idx + END_MESSAGE.length),
                        owns: can_own && input.length == idx + END_MESSAGE.length
                    });
                    message(chunks, pubring, privring);

                    in_message = false;
                    input = input.substring(idx+END_MESSAGE.length);
                    chunks = [];
                    continue;
                }
                chunks.push({
                    node: node,
                    text: input,
                    owns: can_own
                });
                input = '';
            } else if (in_signature) {
                if ((idx = input.indexOf(END_SIG)) !== -1) {
                    chunks.push({
                        node: node,
                        text: input.substring(0, idx + END_SIG.length),
                        owns: can_own && input.length == idx + END_SIG.length
                    });
                    signature(chunks, pubring);

                    in_signature = false;
                    input = input.substring(idx+END_SIG.length);
                    chunks = [];
                    continue;
                }
                chunks.push({
                    node: node,
                    text: input,
                    owns: can_own
                });
                input = '';
            } else {
                if ((idx = input.indexOf(SHARED_BEGIN)) !== -1) {
                    if (input.substring(idx, idx+BEGIN_MESSAGE.length) == BEGIN_MESSAGE)
                        in_message = true;
                    else if (input.substring(idx, idx+BEGIN_SIG.length) == BEGIN_SIG)
                        in_signature = true;

                    input = input.substring(idx);
                    can_own &= idx === 0;
                    continue;
                }


                if ((idx = input.indexOf(BEGIN_MESSAGE)) !== -1) {
                    in_message = true;
                    input = input.substring(idx);
                    continue;
                }
                input = '';
            }
        }
    }
}

function format_signed_data (data, successes, failures) {
    if (successes.length === 0 && failures.length === 0)
        return data;
    if (successes.length > 0)
        data += ' [Verified: '+successes.join(', ')+']';
    if (failures.length > 0)
        data += ' [Unverified: '+failures.join(', ')+']';
    return data;
}

function colorize_result (successes, failures) {
    if (successes.length > 0 && failures.length > 0)
        return MIXED_COLOR;
    if (successes.length > 0)
        return VERIFIED_COLOR;
    if (failures.length > 0)
        return UNVERIFIED_COLOR;
    return UNSIGNED_COLOR;
}

async function display (result, chunks) {
    // deduplicate owned nodes
    const owned_nodes = chunks.filter(c => c.owns).map(c => c.node);
    const successes = [], failures = [];
    for (const sig of result.signatures) {
        try {
            await sig.verified;
            successes.push(sig.keyID.toHex());
        } catch {
            failures.push(sig.keyID.toHex());
        }
    }

    const color = colorize_result(successes, failures);
    owned_nodes[0].textContent = format_signed_data(result.data, successes, failures);
    if (color)
        owned_nodes[0].parentNode.style.color = color;
}

async function signature (chunks, pubring) {
    const message = await openpgp.readCleartextMessage({cleartextMessage: chunks.map(c => c.text).join('\n')});

    const result = await openpgp.verify({
        message: message,
        verificationKeys: pubring
    });
    display(result, chunks);
}

async function message (chunks, pubring, privring) {
    if (privring.length === 0) return;
    const message = await openpgp.readMessage({armoredMessage: chunks.map(c => c.text).join('\n')});

    const result = await openpgp.decrypt({
        message: message,
        decryptionKeys: privring,
        verificationKeys: pubring
    });
    display(result, chunks);
}

render();

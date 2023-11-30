const DISPLAY_MODES = {
    NONE: 0,
    NAME: 1,
    EMAIL: 2,
    USERID: 3
};
/* BEGIN USER-CONFIGURABLE */
const VERIFIED_COLOR = "#008000";
const UNVERIFIED_COLOR = "#800000";
const MIXED_COLOR = "#808000";
const UNSIGNED_COLOR = null;

const DISPLAY_MODE = DISPLAY_MODES.EMAIL;
const DISPLAY_KEYID = false;

const UNKNOWN_USERID_PLACEHOLDER = 'Unknown';
/* END USER-CONFIGURABLE */

const SHARED_BEGIN = '-----BEGIN PGP ';
const BEGIN_MESSAGE = '-----BEGIN PGP MESSAGE-----';
const END_MESSAGE = '-----END PGP MESSAGE-----';
const BEGIN_SIG = '-----BEGIN PGP SIGNED MESSAGE-----';
const END_SIG = '-----END PGP SIGNATURE-----';

async function render () {
    if (document.body.textContent.indexOf(SHARED_BEGIN) === -1) return;
    const pubring = await load_pubkeys();
    const privring = await load_privkeys();

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let in_message = false;
    let in_signature = false;
    let starting = false;
    let chunks = [];

    while (node = walker.nextNode()) {
        let input = node.textContent;
        let trimmed = false;
        let can_own = true;

        while (input.length > 0) {
            if (!trimmed) {
                input = input.trim();
                trimmed = true;
            }
            const bidx = input.indexOf(SHARED_BEGIN, starting ? 1 : 0);
            starting = false;

            if (in_message) {
                const eidx = input.indexOf(END_MESSAGE);
                if (bidx !== -1 && (eidx === -1 || bidx < eidx)) {
                    /* Restart Message */
                    if (input.substring(bidx, bidx+BEGIN_MESSAGE.length) == BEGIN_MESSAGE) {
                        input = input.substring(bidx);
                        can_own &= bidx === 0;
                        chunks = [];
                        starting = true;
                        continue;
                    }
                    /* Switch Modes */
                    else if (input.substring(bidx, bidx+BEGIN_SIG.length) == BEGIN_SIG) {
                        in_message = false;
                        in_signature = true;
                        input = input.substring(bidx);
                        can_own &= bidx === 0;
                        chunks = [];
                        starting = true;
                        continue;
                    }
                }
                /* End Message */
                if (eidx !== -1) {
                    chunks.push({
                        node: node,
                        text: input.substring(0,
                                              eidx + END_MESSAGE.length),
                        owns: can_own && input.length == eidx + END_MESSAGE.length
                    });
                    message(chunks, pubring, privring);

                    in_message = false;
                    input = input.substring(eidx+END_MESSAGE.length);
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
                const eidx = input.indexOf(END_SIG);
                if (bidx !== -1 && (eidx === -1 || bidx < eidx)) {
                    /* Switch Mode */
                    if (input.substring(bidx, bidx+BEGIN_MESSAGE.length) == BEGIN_MESSAGE) {
                        in_message = true;
                        in_signature = false;
                        input = input.substring(bidx);
                        can_own &= bidx === 0;
                        chunks = [];
                        starting = true;
                        continue;
                    }
                    /* Restart Signature */
                    else if (input.substring(bidx, bidx+BEGIN_SIG.length) == BEGIN_SIG) {
                        input = input.substring(bidx);
                        can_own &= bidx === 0;
                        chunks = [];
                        starting = true;
                        continue;
                    }
                }
                /* End Signature */
                if (eidx !== -1) {
                    chunks.push({
                        node: node,
                        text: input.substring(0, eidx + END_SIG.length),
                        owns: can_own && input.length == eidx + END_SIG.length
                    });
                    signature(chunks, pubring);

                    in_signature = false;
                    input = input.substring(eidx+END_SIG.length);
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
                if (bidx !== -1) {
                    if (input.substring(bidx, bidx+BEGIN_MESSAGE.length) == BEGIN_MESSAGE)
                        in_message = true;
                    else if (input.substring(bidx, bidx+BEGIN_SIG.length) == BEGIN_SIG)
                        in_signature = true;

                    starting = true;
                    input = input.substring(bidx);
                    can_own &= bidx === 0;
                    continue;
                }
                input = '';
            }
        }
    }
}

function format_keyid (pubring, keyID) {
    let output;
    const userInfo = pubring[keyID].users[0]?.userID;
    switch (DISPLAY_MODE) {
        case DISPLAY_MODES.NAME:
            output = userInfo?.name ?? UNKNOWN_USERID_PLACEHOLDER;
            break;
        case DISPLAY_MODES.EMAIL:
            output = userInfo?.email ?? UNKNOWN_USERID_PLACEHOLDER;
            break;
        case DISPLAY_MODES.USERID:
            output = userInfo?.userID ?? UNKNOWN_USERID_PLACEHOLDER;
            break;
        case DISPLAY_MODES.NONE:
            return DISPLAY_KEYID ? keyID : '';
    }

    if (DISPLAY_KEYID)
        output += ' (' + keyID + ')';

    return output;
}

function format_signed_data (data, pubring, successes, failures) {
    if (successes.length === 0 && failures.length === 0
        || (DISPLAY_MODE == DISPLAY_MODES.NONE && !DISPLAY_KEYID))
        return data;
    data = data.trimEnd();
    if (successes.length > 0)
        data += ' [Verified: '+successes.map(key => format_keyid(pubring, key)).join(', ')+']';
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

async function display (result, pubring, chunks) {
    // deduplicate owned nodes
    const all_nodes = chunks.map(c => c.node);
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
    const formatted = format_signed_data(result.data, pubring, successes, failures);

    if (owned_nodes.length === 0) {
        const text_node = document.createTextNode('\n(PenguinPGP: '+formatted+')');
        all_nodes[all_nodes.length-1].parentNode.appendChild(text_node);
    } else {
        owned_nodes[0].textContent = formatted;
        if (color)
            owned_nodes[0].parentNode.style.color = color;
        for (let i = 1; i < owned_nodes.length; i++)
            owned_nodes[i].parentNode?.removeChild(owned_nodes[i]);
    }
}

async function signature (chunks, pubring) {
    let message;
    try {
        message = await openpgp.readCleartextMessage({cleartextMessage: chunks.map(c => c.text).join('\n')});
    } catch {
        return;
    }

    const result = await openpgp.verify({
        message: message,
        verificationKeys: Object.values(pubring)
    });
    display(result, pubring, chunks);
}

async function message (chunks, pubring, privring) {
    if (Object.keys(privring).length === 0) return;

    let message, result;
    try {
        message = await openpgp.readMessage({armoredMessage: chunks.map(c => c.text).join('\n')});

        if (message.getEncryptionKeyIDs().length === 0)
            result = await openpgp.verify({
                message: message,
                verificationKeys: Object.values(pubring)
            });
        else
            result = await openpgp.decrypt({
                message: message,
                decryptionKeys: Object.values(privring),
                verificationKeys: Object.values(pubring)
            });
    } catch {
        return;
    }

    display(result, pubring, chunks);
}

const observer = new MutationObserver(render);
observer.observe(document.body, { subtree: false, childList: true });
render();

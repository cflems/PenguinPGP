async function get_privring () {
    return (await chrome.storage.local.get(["privRing"]))?.privRing ?? {};
}

function put_privring (privring) {
    return chrome.storage.local.set({"privRing": privring});
}

async function get_pubring () {
    return (await chrome.storage.local.get(["pubRing"]))?.pubRing ?? {};
}

function put_pubring (pubring) {
    return chrome.storage.local.set({"pubRing": pubring});
}

async function load_privkeys () {
    const privring = await get_privring();
    const privkeys = {};

    for (const keyID of Object.keys(privring)) {
        const pk = privring[keyID];
        privkeys[keyID] = await openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: pk.key }),
            passphrase: pk.passphrase
        });
    }
    return privkeys;
}

async function put_privkey (keyID, pk) {
    const privring = await get_privring();
    privring[keyID] = pk;
    await put_privring(privring);
}

async function delete_privkey (keyID) {
    const privring = await get_privring();
    delete privring[keyID];
    await put_privring(privring);
}

async function load_pubkeys () {
    const pubring = await get_pubring();
    const pubkeys = {};

    for (const keyID of Object.keys(pubring)) {
        pubkeys[keyID] = await openpgp.readKey({
            armoredKey: pubring[keyID].key
        });
    }
    return pubkeys;
}

async function put_pubkey (keyID, pk) {
    const pubring = await get_pubring();
    pubring[keyID] = pk;
    await put_pubring(pubring);
}

async function delete_pubkey (keyID) {
    const pubring = await get_pubring();
    delete pubring[keyID];
    await put_pubring(pubring);
}

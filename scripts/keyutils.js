async function load_privkeys () {
    // const privkeys = await Promise.all(JSON.parse(window.localStorage.privkeys).map(
    //     async pk => openpgp.decryptKey({
    //         privateKey: await openpgp.readPrivateKey({ armoredKey: pk.armored}),
    //         passphrase: pk.passphrase
    //     })
    // ));
    const privring = (await chrome.storage.local.get(["privRing"])).privRing ?? [];
    return await Promise.all(privring.map(
        async pk => openpgp.decryptKey({
            privateKey: await openpgp.readPrivateKey({ armoredKey: pk.key }),
            passphrase: pk.passphrase
        })
    ));
}

async function append_privkey (pk) {
    const privring = (await chrome.storage.local.get(["privRing"])).privRing ?? [];
    privring.push(pk);
    await chrome.storage.local.set({"privRing": privring});
}

async function load_pubkeys () {
    // const pubkeys = await Promise.all(JSON.parse(window.localStorage.keyring).map(
    //     async pk => openpgp.readKey({
    //         armoredKey: pk.armored
    //     })
    // ));
    const pubring = (await chrome.storage.local.get(["pubRing"])).pubRing ?? [];
    return await Promise.all(pubring.map(
        async pk => openpgp.readKey({
            armoredKey: pk.key
        })
    ));
}

async function append_pubkey (pk) {
    const pubring = (await chrome.storage.local.get(["pubRing"])).pubRing ?? [];
    pubring.push(pk);
    await chrome.storage.local.set({"pubRing": pubring});
}

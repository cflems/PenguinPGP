(function () {
    const SECURE_PASSPHRASE_LENGTH = 32;
    const CONFIRM_DELETE_KEY_MESSAGE = 'Are you sure you want to delete this key?';

    const importKeyTab = document.querySelector('#tabs #tabImport');
    const importForm = document.querySelector('#importKey');
    const importStatus = document.querySelector('#importStatus');
    const importKeyData = document.querySelector('#keyData');
    const importPassphrase = document.querySelector('#keyPassphrase');
    const keyLibTab = document.querySelector('#tabs #tabList');
    const keyLib = document.querySelector('#keyLib');

    function randomSecurePassphrase() {
        const chars = [];

        for (let i = 0; i < SECURE_PASSPHRASE_LENGTH; i++) {
            let char = Math.floor(Math.random()*36).toString(36);
            if (Math.random() < 0.5) char = char.toUpperCase();
            chars.push(char);
        }
        return chars.join('');
    }

    function importError (message) {
        importPassphrase.value = '';
        importStatus.classList.add('failure');
        importStatus.classList.remove('success');
        importStatus.textContent = message;
    }

    function importSuccess () {
        importKeyData.value = '';
        importPassphrase.value = '';
        importStatus.classList.add('success');
        importStatus.classList.remove('failure');
        importStatus.textContent = 'Key imported successfully.';
    }

    async function importPrivateKey (armoredKey, passphrase) {
        let keyData;
        try {
            keyData = await openpgp.readPrivateKey({ armoredKey });
        } catch {
            importError('Private key is malformatted.');
            return;
        }
        if (passphrase) {
            try {
                keyData = await openpgp.decryptKey({
                    privateKey: keyData,
                    passphrase
                });
            } catch {
                importError('Key passphrase is incorrect.');
                return;
            }
        }

        const newPass = randomSecurePassphrase();
        let encryptedKey;
        try {
            encryptedKey = await openpgp.encryptKey({
                privateKey: keyData,
                passphrase: newPass
            });
        } catch {
            importError('Missing encrypted key passphrase.');
            return;
        }

        const keyID = encryptedKey.getKeyID().toHex();
        await put_privkey(keyID, {
            key: encryptedKey.armor(),
            passphrase: newPass
        });
        await put_pubkey(keyID, {
            key: keyData.toPublic().armor()
        });
        importSuccess();
    }

    async function importPublicKey (armoredKey) {
        let keyData;
        try {
            keyData = await openpgp.readKey({ armoredKey });
        } catch {
            importError('Public key is malformatted.');
            return;
        }

        const keyID = keyData.getKeyID().toHex();
        await put_pubkey(keyID, {
            key: keyData.armor()
        });
        importSuccess();
    }

    function createKeyElement (pk, copyCallback, deleteCallback) {
        const keyItem = document.createElement('div');
        keyItem.className = 'keyItem';
        const keyTitle = document.createElement('div');
        keyTitle.className = 'keyTitle';
        keyItem.appendChild(keyTitle);
        const keyLabel = document.createElement('h6');
        keyLabel.className = 'keyLabel';
        keyLabel.textContent = pk.getKeyID().toHex();
        keyTitle.appendChild(keyLabel);

        const keyOptions = document.createElement('div');
        keyOptions.className = 'keyOptions';
        keyTitle.appendChild(keyOptions);
        
        const copyKeyButton = document.createElement('button');
        copyKeyButton.className = 'copyKeyButton';
        copyKeyButton.addEventListener('click', copyCallback);
        keyOptions.appendChild(copyKeyButton);

        const deleteKeyButton = document.createElement('button');
        deleteKeyButton.className = 'deleteKeyButton';
        deleteKeyButton.addEventListener('click', async e => {
            if (window.confirm(CONFIRM_DELETE_KEY_MESSAGE)) {
                await deleteCallback();
                renderKeyLib();
            }
        });
        keyOptions.appendChild(deleteKeyButton);

        const identList = document.createElement('ul');
        identList.className = 'identList';
        keyItem.appendChild(identList);
        
        for (ident of pk.users) {
            const identItem = document.createElement('li');
            identItem.className = 'identItem';
            identItem.textContent = ident.userID?.userID;
            identList.appendChild(identItem);
        }


        return keyItem;
    }

    async function renderKeyLib () {
        const pubLib = document.createElement('div'),
              privLib = document.createElement('div'),
              separator = document.createElement('hr');
        pubLib.id = 'pubLib';
        privLib.id = 'privLib';

        const pubLabel = document.createElement('h3'),
              privLabel = document.createElement('h3');
        pubLabel.textContent = 'Known Public Keys';
        privLabel.textContent = 'Private Keys';
        pubLib.appendChild(pubLabel);
        privLib.appendChild(privLabel);

        const pubList = document.createElement('div');
        pubList.id = 'pubList';
        pubList.className = 'keyList';
        const privList = document.createElement('div');
        privList.id = 'privList';
        privList.className = 'keyList';
        pubLib.appendChild(pubList);
        privLib.appendChild(privList);

        const pubring = await load_pubkeys(),
              privring = await load_privkeys();
        const pubIDs = Object.keys(pubring),
              privIDs = Object.keys(privring);

        pubIDs.forEach(keyID => pubList.appendChild(
            createKeyElement(pubring[keyID],
                            () => navigator.clipboard.writeText(pubring[keyID].armor()),
                            () => delete_pubkey(keyID))));
        privIDs.forEach(keyID => privList.appendChild(
            createKeyElement(privring[keyID],
                            () => navigator.clipboard.writeText(privring[keyID].armor()),
                            () => delete_privkey(keyID))));

        if (pubIDs.length === 0) {
            const noPubKeys = document.createElement('p');
            noPubKeys.className = 'loading';
            noPubKeys.textContent = 'You have no public keys.';
            pubList.appendChild(noPubKeys);
        }
        if (privIDs.length === 0) {
            const noPrivKeys = document.createElement('p');
            noPrivKeys.className = 'loading';
            noPrivKeys.textContent = 'You have no private keys.';
            privList.appendChild(noPrivKeys);
        }

        keyLib.replaceChildren(privLib, separator, pubLib);
    }

    /* Tab Button Effects */
    document.querySelectorAll('#tabs button').forEach(n => n.addEventListener('click', function (e) {
        document.querySelectorAll('#tabs button').forEach(btn => btn.classList.remove('selected'));
        n.classList.add('selected');
    }));

    /* Tab Opening */
    importKeyTab.addEventListener('click', function (e) {
        keyLib.classList.add('unselected');
        importForm.classList.remove('unselected');
    });
    keyLibTab.addEventListener('click', function (e) {
        importForm.classList.add('unselected');
        keyLib.classList.remove('unselected');
        renderKeyLib();
    });

    /* Wiring: Import Form */
    importForm.querySelector('#importBtn').addEventListener('click', function (e) {
        if (importKeyData.value.indexOf('PRIVATE') !== -1)
            importPrivateKey(importKeyData.value, importPassphrase.value);
        else
            importPublicKey(importKeyData.value);
    });
})();
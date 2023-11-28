(function () {
    const SECURE_PASSPHRASE_LENGTH = 32;

    const importStatus = document.querySelector('#importStatus');
    const importKeyData = document.querySelector('#keyData');
    const importPassphrase = document.querySelector('#keyPassphrase');

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

        await append_privkey({
            key: encryptedKey.armor(),
            passphrase: newPass
        });
        await append_pubkey({
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

        await append_pubkey({
            key: keyData.armor()
        });
        importSuccess();
    }

    document.querySelectorAll('#tabs button').forEach(n => n.addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelectorAll('#tabs button').forEach(btn => btn.classList.remove('selected'));
        n.classList.add('selected');
    }));
    document.querySelector('#tabs #tabImport').addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector('#keyLib').classList.add('unselected');
        document.querySelector('#importKey').classList.remove('unselected');
    });
    document.querySelector('#tabs #tabList').addEventListener('click', function (e) {
        e.preventDefault();
        document.querySelector('#importKey').classList.add('unselected');
        document.querySelector('#keyLib').classList.remove('unselected');
    });
    document.querySelector('#importBtn').addEventListener('click', function (e) {
        e.preventDefault();
        if (importKeyData.value.indexOf('PRIVATE') !== -1)
            importPrivateKey(importKeyData.value, importPassphrase.value);
        else
            importPublicKey(importKeyData.value);
    });
})();
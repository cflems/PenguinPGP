const DEFAULT_USER_CONFIG = {
    "verified-sig-color": "#008000",
    "unverified-sig-color": "#800000",
    "mixed-sigs-color": "#808000",
    "unsigned-msg-color": "#000000",
    "uid-format": "2",
    "uid-placeholder": "Unknown",
    "display-keyids": false
};

async function get_user_config () {
    return (await chrome.storage.local.get(["userConfig"]))?.userConfig ?? DEFAULT_USER_CONFIG;
}

async function put_user_config (config) {
    return chrome.storage.local.set({"userConfig": config});
}

async function get_config (option) {
    return (await get_user_config())[option];
}

async function put_config (option, value) {
    const config = await get_user_config();
    config[option] = value;
    return put_user_config(config);
}

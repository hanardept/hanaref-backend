function decodeItems(...arguments) {
    return arguments.map((item) => decodeURI(item));
}

module.exports = {
    decodeItems: decodeItems,
};

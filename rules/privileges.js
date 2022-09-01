const itemPrivileges = {
    public: ["שגרה", "חירום"],
    hanar: ["בימל", "בחינה", "שגרה", "חירום"],
    admin: ["בימל", "בחינה", "שגרה", "חירום"],
};
const disallowedSectors = {
    public: ["בימל", "בחינה"],
    hanar: [],
    admin: [],
};

module.exports = { itemPrivileges, disallowedSectors };

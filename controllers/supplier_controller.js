const Supplier = require("../models/Supplier");
const Item = require("../models/Item");
const { decodeItems } = require("../functions/helpers");

module.exports = {
    async getSuppliers(req, res) {
        // GET path: /suppliers?search=jjo&page=0
        const { search, page = 0 } = req.query;
        const [decodedSearch] = decodeItems(search);
        try {
            const suppliers = await Supplier
                .find(search
                    ? {
                        $or: [
                            { id: { $regex: decodedSearch, $options: "i" } },
                            { name: { $regex: decodedSearch, $options: "i" } },
                        ]
                    } : {},
                    { id: 1, name: 1, _id: 1 },
                )
                .sort("name")
                .skip(page * 20)
                .limit(20);
            console.log(`Suppliers found: ${suppliers.length}, list: ${JSON.stringify(suppliers)}`);
            res.status(200).send(suppliers);
        } catch (error) {
            res.status(400).send(`Error fetching suppliers: ${error}`);
        }
    },

    async getSupplierInfo(req, res) {
        try {
            const supplier = await Supplier.findById(req.params.id,
                { _id: 1, name: 1, id: 1, street: 1, city: 1, officePhone: 1, contact: 1, contactCell: 1, contactEmail: 1 });

            if (supplier) {
                res.status(200).send(supplier);
            } else {
                res.status(404).send("Supplier could not be found in database");
            }
        } catch (error) {
            console.log(`Error fetching supplier info: ${error}`);
            res.status(400).send("Supplier fetch error");
        }
    },  

    async addSupplier(req, res) {
        console.log(`adding supplier with body: ${JSON.stringify(req.body)}`);
        const supplierExistsInDB = await Supplier.findOne({
            $or: [
                { id: req.body.id },
                { name: req.body.name },
            ]
        });
        if (supplierExistsInDB) return res.status(400).send("Supplier already registered!");

        const supplier = new Supplier({
            id: req.body.id,
            name: req.body.name,
            street: req.body.street,
            city: req.body.city,
            officePhone: req.body.officePhone,
            contact: req.body.contact,
            contactCell: req.body.contactCell,
            contactEmail: req.body.contactEmail,
        });

        try {
            await supplier.save();
            res.status(200).send("Supplier created!");
        } catch (error) {
            console.log(`Error creating supplier: ${error}`);
            res.status(400).send("Failure saving supplier");
        }
    },

    async editSupplier(req, res) {
        // PUT path: /supplier/962780438
        const { id, name, street, city, officePhone, contact, contactCell, contactEmail } = req.body;

        try {
            await Supplier.findByIdAndUpdate(req.params.id, { id, name, street, city, officePhone, contact, contactCell, contactEmail });
            res.status(200).send("Supplier updated successfully!");
        } catch (error) {
            console.log(`Error updating supplier: ${error}`);
            res.status(400).send("Failure updating supplier");
        }
    },

    async deleteSupplier(req, res) {
        // DELETE path: /suppliers/962780438
        try {
            const referencing = await Item.exists({ supplier: req.params.id });
            if (referencing) {
                return res.status(409).send("Cannot delete supplier - there are items referencing it.");
            }
            await Supplier.findByIdAndRemove(req.params.id);
            res.status(200).send("Supplier removed successfully!");
        } catch (error) {
            console.log(`Error deleting supplier: ${error}`);
            res.status(400).send("Failure deleting supplier");            
        }
    },

    async getSuppliersWorksheet(req, res) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Suppliers');

        console.log(`Generating Excel worksheet for suppliers...`);

        worksheet.columns = [{
            header: 'שם',
            key: 'name',
            width: 30
        }, {
            header: 'מספק ספק במשרד הביטחון',
            key: 'id',
            width: 30
        }, {
            header: 'רחוב',
            key: 'street',
            width: 30
        }, {
            header: 'עיר',
            key: 'city',
            width: 20
        }, {
            header: 'מספר טלפון משרדי',
            key: 'officePhone',
            width: 20
        }, {
            header: 'שם איש קשר',
            key: 'contact',
            width: 20
        }, {
            header: 'נייד איש קשר',
            key: 'contactCell',
            width: 20
        }, {
            header: 'מייל איש קשר',
            key: 'contactEmail',
            width: 20,
        }];

        let suppliers;
        let offset = 0;
        const batchSize = 500;
        do {
            suppliers = await Supplier.find({}, { 
                    id: 1, name: 1, street: 1, city: 1, officePhone: 1, contact: 1, contactCell: 1, contactEmail: 1 
                })
                .sort('name')
                .skip(offset)
                .limit(batchSize);
            if (suppliers?.length) {
                worksheet.addRows(suppliers.map(({ 
                    id, name, street, city, officePhone, contact, contactCell, contactEmail 
                }) => (
                    { 
                        id, name, street, city, officePhone, contact, contactCell, contactEmail
                    }
                )));
            }
            offset += batchSize;
        } while (suppliers.length > 0);

        // Set the response headers
        res.setHeader(
            'Content-Type',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        res.setHeader(
            'Content-Disposition',
            'attachment; filename=' + 'suppliers.xlsx'
        );

        try {
            await workbook.xlsx.write(res);
            res.end();
        } catch (error) {
            console.error('Error sending Excel file:', error);
            res.status(500).send('Error sending Excel file');
        }
    }    
};

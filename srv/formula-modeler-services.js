const cds = require("@sap/cds");
const utils = require("./lib/utils");

module.exports = cds.service.impl(async function () {
    const { FormulaModeler } = this.entities;
    const db = await cds.connect.to('db');


    this.on('executeSQL', async (req) => {
        formulaID = req.data.params.ID;
        queryFilter = req.data.params.FILTER;
        // Translate the request to an SQL
        try{
            const sqlExpression = utils.generate(formulaID, queryFilter);
            return { sql: sqlExpression };
        }catch (error) {    
            req.error(400, "Unable to convert the request to an executable SQL", error.message);
        }

        // TODO: Validate the SQL expression

        try {
            const result = await db.tx(req).run(sql);
            return { result };
        } catch (error) {
            req.error(400, error.message);
        }
    });
});

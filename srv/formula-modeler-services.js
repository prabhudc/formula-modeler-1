const cds = require("@sap/cds");
const utils = require("./lib/utils");
const math = require("mathjs");
const { json } = require("@sap/cds/lib/compile/parse");
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

    function createFormulaAST(node) {
        // Parse the AST into a JSON object
        const json = JSON.stringify(node, null, 2);
    
        node.traverse(function (node, path, parent) {
        switch (node.type) {
            case 'OperatorNode':
            console.log(node.type, node.op)
            break
            case 'ConstantNode':
            console.log(node.type, node.value)
            break
            case 'SymbolNode':
            console.log(node.type, node.name)
            break
            default:
            console.log(node.type)
        }
        })
    }

    this.on('createFormula', async (req, res) => {
        const {title, description, formula, modelAliases } = req.data;
        const formulaPayload = {
            title,
            description,
            formula,
            modelAliases 
        };
        // Parse the formula into an AST
        const ast = math.parse(formula);
        createFormulaAST(ast);

        res = await INSERT.into("Formulae").entries({
            title: title,
            description: description,
            formula: formula, 
            models: modelAliases
        });
        console.log(res);
        
    });
});

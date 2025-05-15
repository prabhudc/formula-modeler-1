const cds = require("@sap/cds");
const utils = require("./lib/utils");
const math = require("mathjs");
const coreservices = require("./lib/core-services");
const { json } = require("@sap/cds/lib/compile/parse");
module.exports = cds.service.impl(async function () {
    const { FormulaModeler } = this.entities;
    const db = await cds.connect.to('db');


    this.on('executeFormulaOnModel', async (req) => {
        const formulaID = req.data.formulaID;
        const keyAttributeList = req.data.params.keys;
        const db = await cds.connect.to('db'); 
        
        // Input param checks
        !formulaID? req.error(400, "Formula ID is required") : null;
        !keyAttributeList || keyAttributeList.length === 0  ? req.error(400, "Key attribute list for model is required") : null;
        

        // Translate the request to an SQL
        try {
            // Retrieve formula for the formula ID
            const responseFormula = await coreservices.getFormulaById(formulaID);
            cds.log().info("Formula retrieved: ", responseFormula);

            const responseTargetModel = await coreservices.getTargetModelByFormulaId(formulaID);
            cds.log().info("Target model retrieved: ", responseTargetModel);
            
            const keySelectFieldString = "\'" + keyAttributeList.join("\',\'") + "\'";
            cds.log().info("Key select fields: ", keySelectFieldString);
            // const sqlFormulaSelectStatement = `create or replace view v_test_formula as (select ${keySelectFieldString},${responseFormula.P_FORMULA} as O_CALCULATED from ${responseTargetModel.schemaName}.\"${responseTargetModel.targetModel}\")`;
            const dataRetrievalProxyObject = `zfx_${cds.utils.uuid().replace(/-/g, '')}`

            // Read the metadata view view_columns to get the 
            // data types of the columns to be queried
            const keySelectFieldDataTypes = await cds.run(`select 
                                rtrim(
                                column_name||' '||
                                case when data_type_name in ('NVARCHAR', 'VARCHAR', 'CHAR') then  data_type_name||'('||length||'),'
                                    when data_type_name in ('INTEGER', 'TIMESTAMP', 'DATE') then data_type_name
                                end,',') as column_data_types
                        from view_columns
                        where schema_name = '${responseTargetModel.schemaName}'
                        and view_name = '${responseTargetModel.targetModel}'
                        and column_name in (${keySelectFieldString})`);
            
            if (!keySelectFieldDataTypes || keySelectFieldDataTypes.length !== keyAttributeList.length) {
                throw new Error("Unable to retrieve the data types of the key attributes");
            }
            cds.log().info(keySelectFieldDataTypes); 
            const createDataRetrievalProxyObject = `create function ${dataRetrievalProxyObject} ()
            returns table (${keySelectFieldDataTypes.map((item) => item.COLUMN_DATA_TYPES).join(',')}, O_CALCULATED Decimal(20,5))
            as begin
                return select ${keySelectFieldString.replaceAll('\'','"')}, ${responseFormula.P_FORMULA} as O_CALCULATED from ${responseTargetModel.schemaName}.\"${responseTargetModel.targetModel}\";
            end;`
            
            await cds.run(' call "pr_create_proxy_object"( ? ) ', createDataRetrievalProxyObject);
            
            cds.log().info("Create function SQL: ", createDataRetrievalProxyObject);

            await UPDATE('Formulae').set({ dataRetrievalProxyObject: dataRetrievalProxyObject }).where({ ID: formulaID });
             // Validate the DB object with a test execution
            await cds.run(`select top 1 * from ${dataRetrievalProxyObject}()`)
            

            cds.log().info("Key select fields data types: ", keySelectFieldDataTypes);


            // await cds.run(`CREATE LOCAL TEMPORARY TABLE ${ltt} as (select ${keySelectFieldString},${responseFormula.P_FORMULA} as O_CALCULATED from ${responseTargetModel.schemaName}.\"${responseTargetModel.targetModel}\")`)
            // cds.log().info("SQL statement: ", sqlFormulaSelectStatement);
            // resultFormulaSelectStatement = await cds.run(`select * from ${ltt}`);
            // resultFormulaSelectStatement = await cds.run(sqlFormulaSelectStatement);

            // cds.log().info("Result of SQL statement: ", resultFormulaSelectStatement);
            // const resultProc = await cds.run('call "pr_create_formula_view"(?, ?)', '');
            // cds.log().info("Result of SQL procedure: ", resultProc);
            // select {keys},{responseFormula.P_FORMULA} as O_CALCULATED  from {schameName}.{targetModel}
            // TODO: Retrieve the schema and target model 
            // TODO: Form the SQL statement
            // TODO: Try to create a DB view based on the statement
            // TODO: Execute select on the view and return the result
            
            return(200,  [responseFormula, responseTargetModel]);

        } catch (error) {
            // Handle errors and provide a meaningful error message
            req.error(400, "Unable to convert the request to an executable SQL", error.message);
        }

    });

    function createFormulaAST(node) {
        // Parse the AST into a JSON object
        const json = JSON.stringify(node, null, 2);
    
        node.traverse(function (node, path, parent) {
        switch (node.type) {
            case 'OperatorNode':
            cds.log().info(node.type, node.op)
            break
            case 'ConstantNode':
            cds.log().info(node.type, node.value)
            break
            case 'SymbolNode':
            cds.log().info(node.type, node.name)
            break
            default:
            cds.log().info(node.type)
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
        cds.log().info(res);
        
    });
});

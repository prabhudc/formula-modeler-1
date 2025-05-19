const cds = require("@sap/cds");
const utils = require("./lib/utils");
const math = require("mathjs");
const coreservices = require("./lib/core-services");
const { json } = require("@sap/cds/lib/compile/parse");
const DEFAULTS = require("./lib/constants").DEFAULTS;

module.exports = cds.service.impl(async function () {
    const { FormulaModeler } = this.entities;
    const db = await cds.connect.to('db');


    this.on('buildFormulaOnModelbyFormulaID', async (req) => {
        /**
         * Builds a formula on a model by its formula ID and key attributes.
         * @param {Object} req - The request object containing the formula ID and KEY attributes.
         * @returns {Promise<Object>} - A promise that resolves to the response object.
         * @description The function first checks if the formula ID and key attributes are provided in the request.
         * If not, it throws an error. Then, it attempts to retrieve the formula and target model associated with
         * the formula ID from the database. If successful, it builds a SQL statement to create a proxy object
         * for data retrieval and updates the proxy DB object name in the formulae entity.
         */
        const formulaID = req.data.formulaID;
        const keyAttributeList = req.data.params.keys;
        const db = await cds.connect.to('db'); 
        
        // Input param checks
        if (!formulaID) 
            throw new Error("Formula ID is required (buildFormulaOnModelbyFormulaID)");
        if (!keyAttributeList || keyAttributeList.length === 0)
            throw new Error("Key attribute list for model is required (buildFormulaOnModelbyFormulaID)");

        try {
            // Retrieve formula for the formula ID
            const responseFormula = await coreservices.getFormulaById(formulaID);
            // Retrieve target model for the formula ID
            const responseTargetModel = await coreservices.getTargetModelByFormulaId(formulaID);
            // Retrieve the proxy DB object name for the formula ID
            const dataRetrievalProxyObject = await coreservices.getDataRetrievalProxyObject(formulaID);
            // Get the SQL to create the proxy object
            const createDataRetrievalProxyObjectSQL = await coreservices.buildDataRetrievalProxyObject(responseFormula, responseTargetModel, keyAttributeList, dataRetrievalProxyObject);
            // Create the proxy object in the DB
            await cds.run(' call "pr_create_proxy_object"( ? ) ', createDataRetrievalProxyObjectSQL);
            // Update the proxy DB object name in the formulae entity
            await UPDATE('Formulae').set({ dataRetrievalProxyObject: dataRetrievalProxyObject  }).where({ ID: formulaID });
          
            return(200,  [responseFormula, responseTargetModel]);

        } catch (error) {
            cds.log().error(`Unable to build the formula on the model for formula ID ${formulaID}`, error.message); 
            req.error(400, `Unable to convert the request to an executable SQL for formula ${formulaID}`, error.message);
        }

    });

    this.on("retrieveDataForFormulaID", async (req) => {
        /**
         * Retrieves data for a given formula ID by executing a SQL statement
         * that calls a stored procedure or function.
         * @param {Object} req - The request object containing the formula ID.
         * @returns {Promise<Object>} - A promise that resolves to the retrieved data.
         * @description The function first checks if the formula ID is provided in the request.
         * If not, it throws an error. Then, it attempts to retrieve the data retrieval proxy object
         * associated with the formula ID from the database. If the object is found, it executes
         * a SQL statement to call the proxy object and retrieve the data. If successful, it returns
         * the retrieved data.
         */
      "use strict";
      const formulaID = req.data.formulaID;
      if (!formulaID) throw new Error("Formula ID is required");

      try {
        const dbObject = await SELECT.one
          .from("Formulae")
          .columns("dataRetrievalProxyObject")
          .where({ ID: formulaID });

        if (!dbObject || !dbObject.dataRetrievalProxyObject)
          throw new Error("Unable to retrieve the data retrieval object (retrieveDataForFormulaID)");
        // Query dataset with pagination 
        const retrieveDataFromProxyObject = await cds.run(
          `select * from "${dbObject.dataRetrievalProxyObject}"(  )
          limit ${req.req.query.$top || DEFAULTS.query_limit}
          offset ${req.req.query.$skip || 0}
          `,
        );

        if (!retrieveDataFromProxyObject) 
          throw new Error(`Could not retrieve data from the proxy object (retrieveDataForFormulaID)`);
        
        return {
          status: 200,
          data: retrieveDataFromProxyObject,
          // Return the current offset
          next : parseInt(req.req.query.$skip || 0) + retrieveDataFromProxyObject.length};

      } catch (error) {
        cds.log().error(`Unable to retrieve data for formula ID ${formulaID}`,error.message);
        req.error(400,`Unable to retrieve data for formula ID ${formulaID}`,error.message);
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
    };

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

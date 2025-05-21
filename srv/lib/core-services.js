
const cds = require("@sap/cds");
const math = require("mathjs");

module.exports = {
  getFormulaById: async function (formulaID) {
    /**
     * Retrieves the formula from the database using the provided formula ID.
     * @param {string} formulaID - The ID of the formula to look up.
     * @returns {Promise<{ P_FORMULA: string } | undefined>}
     * @description The resulting object contains the 'P_FORMULA' property if a matching record is found, or undefined otherwise.
     */

    // Define the SQL procedure to retrieve the formula
    const sqlGetFormulaProcedure = 'call "pr_get_formula"(?, ?)';
    try {
      // Execute the SQL procedure
      resFormula = await cds.run(sqlGetFormulaProcedure, formulaID);
      if (!resFormula || !resFormula.P_FORMULA)
        throw new Error(`Database did not return a formula  (getFormulaById)`);
    } catch (error) {
      throw error;
    }
    return resFormula;
  },

  getTargetModelByFormulaId: async function (formulaID) {
    /**
     * Retrieves the target HANA mocdel for the specified formula ID.
     * @param {string} formulaID - The ID of the formula to look up.
     * @type {Promise<{ model_ID: string } | undefined>}
     * @description Executes a SELECT query on the "FormulaModels" table to fetch the "modelID" where the "parent" matches the provided formulaID.
    */
   
    let resultTargetModel; // Define the variable outside the try block
    try {
      const targetModelId = await SELECT.one
        .from("FormulaModels")
        .columns("model")
        .where({ parent: formulaID });

      if (!targetModelId || !targetModelId.model_ID)
        throw new Error(`Target model ID not found for formula ID ${formulaID}`);

      resultTargetModel = await SELECT.one
        .from("TargetModels")
        .columns("schemaName", "targetModel")
        .where({ ID: targetModelId.model_ID });
      
      if (
        !resultTargetModel ||
        !resultTargetModel.schemaName ||
        !resultTargetModel.targetModel
      )throw new Error(`Target model details not found for Target Model ID ${targetModelId.model_ID}`);

    } catch (error) {
      throw error;
    }
    return resultTargetModel;
  }, 

  getDataRetrievalProxyObject: async function (formulaID) {
  
    /**
     * Retrieves a single record from the "Formulae" table, selecting only the 'dataRetrievalProxyObject' column,
     * where the record's ID matches the provided formulaID.
     * @param {string} formulaID - The ID of the formula to look up.
     * @returns {Promise<{ dataRetrievalProxyObject: string } | undefined>} - A promise that resolves to an object containing the 'dataRetrievalProxyObject' property if found, or undefined if not.
     * @description The resulting object contains the 'dataRetrievalProxyObject' property if a matching record is found, or undefined otherwise.
     */

     // Look for an existing proxy DB object for the formula ID
    const existingDBObject = await SELECT.one
      .from("Formulae")
      .columns('dataRetrievalProxyObject')
      .where({ ID: formulaID });

    let proxyObjectName;

    if (existingDBObject && existingDBObject.dataRetrievalProxyObject) {
        // If the object already exists, retain as the proxy object
        proxyObjectName = existingDBObject.dataRetrievalProxyObject;
    }else {
        // If the object does not exist, create a new DB object
        proxyObjectName = `zfx_${cds.utils.uuid().replace(/-/g, '')}`;
    }

    return proxyObjectName;
  },

  buildDataRetrievalProxyObject: async function (responseFormula, responseTargetModel, keyAttributeList, dataRetrievalProxyObject) {
    /**
     * Builds a SQL statement to create a proxy object for data retrieval.
     * 
     * @param {Object} responseFormula - The formula response object.
     * @param {Object} responseTargetModel - The target model response object.
     * @param {Array} keyAttributeList - List of key attributes.
     * @param {string} dataRetrievalProxyObject - Name of the data retrieval proxy object.
     * @returns {string} - SQL statement to create the proxy object.
     */

    // Concatenate the key to use in a where-clause
    keySelectFieldString = keyAttributeList.map((item) => `'${item}'`).join(",");  
    // Look up the data types of the key columns
    const keySelectFieldDataTypes = await cds.run(`select 
                        column_name,
                        rtrim(
                        '"'||column_name||'" '||
                        case when data_type_name in ('NVARCHAR', 'VARCHAR', 'CHAR') then  data_type_name||'('||length||'),'
                            when data_type_name in ('INTEGER', 'TIMESTAMP', 'DATE') then data_type_name
                        end,',') as column_data_types
                from view_columns
                where schema_name = '${responseTargetModel.schemaName}'
                and view_name = '${responseTargetModel.targetModel}'
                and column_name in (${keySelectFieldString})
                order by position`);
    if (!keySelectFieldDataTypes || keySelectFieldDataTypes.length !== keyAttributeList.length) 
      throw new Error("Unable to retrieve the data types of the key attributes (buildDataRetrievalProxyObject) ");
    
    const createDataRetrievalProxyObject = `create or replace function "${dataRetrievalProxyObject}" ()
      returns table (${keySelectFieldDataTypes.map((item) => item.COLUMN_DATA_TYPES).join(',')}, O_CALCULATED Decimal(20,5))
      as begin
          return select "${keySelectFieldDataTypes.map((item) => item.COLUMN_NAME).join('","')}", ${responseFormula.P_FORMULA} as O_CALCULATED from ${responseTargetModel.schemaName}.\"${responseTargetModel.targetModel}\";
      end;`
    

    return createDataRetrievalProxyObject; 
  },

  

  createVerticesAndEdgesFromAst : async function (ast, req) {
      /**
       * Parses the Abstract Syntax Tree (AST) and creates vertices and edges for the graph representation.
       * @param {Object} ast - The Abstract Syntax Tree (AST) of the formula.
       * @param {Object} req - The request object containing the formula data.
       * @description The function traverses the AST, creating nodes and edges based on the node types and their relationships.
       */
      const nodeFormula = req.data.Nodes[0].node_formula;
      const formulaID = req.data.ID; 
      const nodeArray = [];
      const edgeArray = [];
      // Initialize the root node ID
      const rootNodeID = cds.utils.uuid();
      // Go over the AST and assign UUIDs to each node
      // will be used as ID for Nodes entity
      ast.traverse(function(node,path,parent) {
        if (node.type === 'OperatorNode' || node.type === 'ConstantNode' || node.type === 'SymbolNode') {
          node.ID = cds.utils.uuid();
        } else {
          node.ID = parent ? parent.ID:rootNodeID;
        }
      });
      
      // Create the root node
      nodeArray.push({
              ID: rootNodeID,
              node_is_root: true,
              node_is_leaf: false,
              node_is_constant: false,
              node_is_variable: false,
              node_operator: '',
              node_operand: '',
              node_formula: nodeFormula,
              formula_ID: formulaID
            });
    
      const parentNodeIDSet = new Set();// To track left-hand side parent already visited
      let edgeLocation = '';

      // Helper to determine the edge location
      // 'n' = first edge, 'l' = lhs, 'r' = rhs
      ast.traverse(function (node, path, parent) {
        if (edgeArray.length === 0) {
          edgeLocation = 'n';
        } else if (parent && parentNodeIDSet.has(parent.ID)) {
          edgeLocation = 'r';
        } else if (parent && !parentNodeIDSet.has(parent.ID)) {
          parentNodeIDSet.add(parent.ID);
          edgeLocation = 'l';
        }

        switch (node.type) {
          case 'OperatorNode':
            nodeArray.push({
              ID: node.ID,
              node_is_root: false,
              node_is_leaf: false,
              node_is_constant: false,
              node_is_variable: false,
              node_operator: node.op,
              node_operand: '',
              node_formula: '',
              formula_ID: formulaID
            });

            edgeArray.push({
              ID: cds.utils.uuid(),
              start_ID: parent ? parent.ID : rootNodeID,
              end_ID: node.ID,
              edge_location: edgeLocation,
              formula_ID: formulaID
            });

            break
          case 'ConstantNode':
            nodeArray.push({
              ID: node.ID,
              node_is_root: false,
              node_is_leaf: true,
              node_is_constant: isNaN(node.value)? false: true, 
              node_is_variable: false,
              node_operator: '',
              node_operand: node.value,
              node_formula: '',
              formula_ID: formulaID
            });

            edgeArray.push({
              ID: cds.utils.uuid(),
              start_ID: parent.ID,
              end_ID: node.ID,
              edge_location: edgeLocation,
              formula_ID: formulaID
            });

            break
          case 'SymbolNode':
            nodeArray.push({
              ID: node.ID,
              node_is_root: false,
              node_is_leaf: true,
              node_is_constant: false,
              node_is_variable: false,
              node_operator: '',
              node_operand: node.name,
              node_formula: '',
              formula_ID: formulaID
            });
            edgeArray.push({
              ID: cds.utils.uuid(),
              start_ID: parent.ID,
              end_ID: node.ID,
              edge_location: edgeLocation,
              formula_ID: formulaID
            });

            break
          default:
            cds.log().info("Skipped Node",node.type)
        }
      });
      return {"nodeArray": nodeArray, "edgeArray": edgeArray};
    },

  createFormulaEntryPayload: async function (req) {
    /**
     * Creates a payload for a new formula entry.
     * @param {Object} req - The request object containing the formula data.
     * @returns {Object} - The payload object for the new formula entry.
     * @description The function extracts the formula data from the request and constructs a payload object
     *              with the necessary properties for creating a new formula entry in the database.
     */
    
    const formula = req.data.formula;
    const nodeFormula = req.data.Nodes[0].node_formula;

    // Parse the formula into an AST
    const ast = math.parse(formula);
    resultAstGraph = await this.createVerticesAndEdgesFromAst(ast, req);

    req.data.Nodes = resultAstGraph.nodeArray;
    req.data.Edges = resultAstGraph.edgeArray;
    return ;
  }
};

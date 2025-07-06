const cds = require("@sap/cds");
const { add } = require("@sap/cds/lib/srv/middlewares");
const math = require("mathjs");
const DEFAULTS = require("./constants").DEFAULTS;

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


  getKeyAttributesByFormulaId: async function (formulaID) {
  //   /**
  //    * Retrieves the key attributes for the specified formula ID.
  //    * @param {string} formulaID - The ID of the formula to look up.
  //    * @description Executes a SELECT query on the "Formulae" table to fetch the "keyAttributes" where the "ID" matches the provided formulaID.
  //    * If no key attributes are found, it returns an empty array.
  //    */
  //   const keyAttributes = await SELECT.from("Formulae")

  // 1. with input as formulaID, Navigate from Formulae to Nodes and then to Parameters
  // 2. Nodes should be filtered by node_is_root = true
  // 3. Parameters should be filtered by parameter_type = 'formula_dimension' and parameter_name = 'key'
  // 4. Return the parameter_value from all the records and combine as array and return
  const keyAttributes = await SELECT.from("Formulae")
    .columns("parameter_value")
    .where({ "Formulae.ID": formulaID })
    .join("Nodes").on({ "Nodes.formula_ID": "Formulae.ID" })
    .join("Parameters").on({ "Parameters.node_ID": "Nodes.ID" })
    .where({ "Nodes.node_is_root": true })
    .where({ "Parameters.parameter_type": 'formula_dimension', "Parameters.parameter_name": 'key' });
  
    const keyAttributeList = keyAttributes.map(attr => attr.parameter_value);

    if (!keyAttributeList || keyAttributeList.length === 0) {
      throw new Error(`No key attributes found for formula ID ${formulaID}`);
    }

    return keyAttributeList;
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

    // Check for aggregation functions in the formula
    const formulaNoSpaces = responseFormula.P_FORMULA.replace(/\s+/g, '').toLowerCase();

// Check if formula contains window function syntax
const hasWindowFunction = formulaNoSpaces.includes(')over(');

const hasAggregation = !hasWindowFunction && DEFAULTS.supportedAggregationFunctions
    .map(fn => fn + '(')
    .some(fnWithParen => formulaNoSpaces.includes(fnWithParen));

let groupByClause = "";
if (hasAggregation) {
  groupByClause = ` group by \"${keySelectFieldDataTypes.map((item) => item.COLUMN_NAME).join('","')}\"`;
}

    const createDataRetrievalProxyObject = `create or replace function "${dataRetrievalProxyObject}" ()
      returns table (${keySelectFieldDataTypes.map((item) => item.COLUMN_DATA_TYPES).join(',')}, O_CALCULATED Decimal(20,5))
      as begin
          return select "${keySelectFieldDataTypes.map((item) => item.COLUMN_NAME).join('","')}", ${responseFormula.P_FORMULA} as O_CALCULATED 
                 from ${responseTargetModel.schemaName}.\"${responseTargetModel.targetModel}\"${groupByClause};
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
  const keyAttributeList = req.data.Nodes[0].Parameters;
  // Initialize the root node ID
  const rootNodeID = cds.utils.uuid();
  
  // Go over the AST and assign UUIDs to each node
  ast.traverse(function(node, path, parent) {
    if (node.type === 'OperatorNode' || node.type === 'ConstantNode' || node.type === 'SymbolNode' || node.type === 'FunctionNode' ) {
      node.ID = cds.utils.uuid();
    } else {
      node.ID = parent ? parent.ID : rootNodeID;
    }
  });

  let additionalParams = [];

  if (Array.isArray(keyAttributeList)) {
    keyAttributeList.forEach(attr => {
      if (attr.parameter_value !== undefined && attr.parameter_value !== null && attr.parameter_value !== '') {
        additionalParams.push(
          {
            parameter_type: "formula_dimension",
            parameter_name: "key",
            parameter_value: attr.parameter_value
          }
        );
      }
    });
  }

  if(keyAttributeList.length === 0) {
    throw new Error("Key attributes for the formula are required");
  }
  
  nodeArray.push({
    ID: rootNodeID,
    node_is_root: true,
    node_is_leaf: false,
    node_is_constant: false,
    node_is_variable: false,
    node_operator: '',
    node_operand: '',
    node_formula: nodeFormula,
    formula_ID: formulaID,
    Parameters : additionalParams 
  });

  // Track parent nodes that have been processed for edge location determination
  const parentChildrenCount = new Map(); // Track how many children each parent has processed
  let edgeLocation = '';

  // Helper to determine the edge location
  function getEdgeLocation(parent) {
    if (!parent) {
      return 'n'; // Root edge
    }
    
    const parentID = parent.ID;
    const currentChildCount = parentChildrenCount.get(parentID) || 0;
    parentChildrenCount.set(parentID, currentChildCount + 1);
    
    if (parent.type === 'FunctionNode') {
      return 'l'; // Function nodes only have left edges
    }
    
    return currentChildCount === 0 ? 'l' : 'r';
  }

  // Track if we've processed the first edge
  let isFirstEdge = true;

  ast.traverse(function (node, path, parent) {
    // Skip ParenthesisNode completely since it shares ID with parent
    if (node.type === 'ParenthesisNode') {
      return;
    }

    let additionalParams = [];
    
    // Use the first edge flag to mark the very first edge as 'n'
    if (isFirstEdge) {
      edgeLocation = 'n'; // Root edge
      isFirstEdge = false;
    } else {
      edgeLocation = getEdgeLocation(parent);
    }

    switch (node.type) {
      case 'OperatorNode':
        if (parent && parent.type === 'FunctionNode' && DEFAULTS.supportedWindowFunctions.includes(parent.fn.name.toString().toLowerCase())) {
          throw new Error(`Nesting of window functions with other functions not supported : ${node.op} in function ${parent.fn.name}`);
        }

        nodeArray.push({
          ID: node.ID,
          node_is_root: false,
          node_is_leaf: false,
          node_is_constant: false,
          node_is_variable: false,
          node_operator: node.op,
          node_operand: '',
          node_formula: '',
          formula_ID: formulaID,
          Parameters: []
        });

        edgeArray.push({
          ID: cds.utils.uuid(),
          start_ID: parent ? parent.ID : rootNodeID,
          end_ID: node.ID,
          edge_location: edgeLocation,
          formula_ID: formulaID
        });
        break;

      case 'ConstantNode':
        nodeArray.push({
          ID: node.ID,
          node_is_root: false,
          node_is_leaf: true,
          node_is_constant: isNaN(node.value) ? false : true, 
          node_is_variable: false,
          node_operator: '',
          node_operand: node.value,
          node_formula: '',
          formula_ID: formulaID,
          Parameters: []
        });

        edgeArray.push({
          ID: cds.utils.uuid(),
          start_ID: parent.ID,
          end_ID: node.ID,
          edge_location: edgeLocation,
          formula_ID: formulaID
        });
        break;

      case 'SymbolNode':
        // Skip certain symbol nodes  
        if (DEFAULTS.supportedAggregationFunctions.includes(node.name.toLowerCase())) break; 
        if (DEFAULTS.supportedWindowFunctions.includes(node.name.toLowerCase())) break;

        if (parent && parent.type === 'FunctionNode' && DEFAULTS.supportedWindowFunctions.includes(parent.fn.name.toString().toLowerCase())) {
          const siblingEdges = edgeArray.filter(edge => edge.start_ID === parent.ID);
          if (siblingEdges.length > 0) {
            const siblingNode = nodeArray.find(n => n.ID === siblingEdges[0].end_ID);
            if (siblingNode) {
              siblingNode.Parameters.push(
                {
                  parameter_type: "window",
                  parameter_name: "partition_key",
                  parameter_value: node.name
                }
              );
            }     
            break; 
          }
        }

        nodeArray.push({
          ID: node.ID,
          node_is_root: false,
          node_is_leaf: true,
          node_is_constant: false,
          node_is_variable: false,
          node_operator: '',
          node_operand: node.name,
          node_formula: '',
          formula_ID: formulaID,
          Parameters: additionalParams
        });

        edgeArray.push({
          ID: cds.utils.uuid(),
          start_ID: parent.ID,
          end_ID: node.ID,
          edge_location: edgeLocation,
          formula_ID: formulaID
        });
        break;

      case 'FunctionNode':
        if (!DEFAULTS.supportedAggregationFunctions.includes(node.fn.toString().toLowerCase()) &&
            !DEFAULTS.supportedWindowFunctions.includes(node.fn.toString().toLowerCase())) {
          throw new Error(`Function ${node.fn} is not supported in the formula AST`);
        } 

        const functionName = DEFAULTS.function_mapping[node.fn.toString().toLowerCase()] || node.fn.toString().toLowerCase();
        let parameterArray = [];

        nodeArray.push({
          ID: node.ID,
          node_is_root: false,
          node_is_leaf: false,
          node_is_constant: false,
          node_is_variable: false,
          node_operator: functionName,
          node_operand: '',
          node_formula: '',
          formula_ID: formulaID,
          Parameters: parameterArray
        });

        edgeArray.push({
          ID: cds.utils.uuid(),
          start_ID: parent ? parent.ID : rootNodeID,
          end_ID: node.ID,
          edge_location: edgeLocation,
          formula_ID: formulaID
        });
        break;

      default:
        cds.log().info("Skipped Node", node.type);
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


const cds = require("@sap/cds");

module.exports = {
  getFormulaById: async function (formulaID) {
    // Define the SQL procedure to retrieve the formula
    const sqlGetFormulaProcedure = 'call "pr_get_formula"(?, ?)';
    try {
      // Execute the SQL procedure
      resFormula = await cds.run(sqlGetFormulaProcedure, formulaID);
      if (!resFormula || !resFormula.P_FORMULA)
        throw new Error(
          `Database did not return a formula for formulaID ${formulaID}`
        );
    } catch (error) {
      throw error;
    }
    return resFormula;
  },

  getTargetModelByFormulaId: async function (formulaID) {
    let resultTargetModel; // Define the variable outside the try block
    try {

      const targetModelId = await SELECT.one
        .from("FormulaModels")
        .columns("modelID")
        .where({ parent: formulaID });

      if (!targetModelId || !targetModelId.modelID)
        throw new Error(
          `Target model ID not found for formula ID ${formulaID}`
        );

      resultTargetModel = await SELECT.one
        .from("TargetModels")
        .columns("schemaName", "targetModel")
        .where({ ID: targetModelId.modelID });
      
      if (
        !resultTargetModel ||
        !resultTargetModel.schemaName ||
        !resultTargetModel.targetModel
      )throw new Error(`Target model details not found for Target Model ID ${targetModelId.modelID}`);

    } catch (error) {
      throw error;
    }
    return resultTargetModel;
  },
};

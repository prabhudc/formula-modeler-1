using Formulae as _formulae from '../db/data-model.cds';
using FormulaModels as _formulamodels from '../db/data-model.cds';
using TargetModels as _targetmodels from '../db/data-model.cds';


service FormulaModelerServices {

    // Maintain Formulae
    entity Formulae      as projection on _formulae;
    // Maintain FormulaModels
    entity FormulaModels as projection on _formulamodels;
    // Maintain TargetModels
    entity TargetModels  as projection on _targetmodels;
    // Main service to execute the formula
    action buildFormulaOnModelbyFormulaID(formulaID : UUID,
                                 params : {
        keys    : array of String;
        filters : array of {
            operand  : String;
            operator : String;
            value    : String;
        }
    }) returns array of String;

    // Formula data retrieval
    function retrieveDataForFormulaID(formulaID : UUID) returns array of {};

}


service SandboxService {
    action createFormula(title : String, description : String, formula : String, modelAliases : array of String);
}

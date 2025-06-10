using Formulae as _formulae from '../db/data-model.cds';
using FormulaModels as _formulamodels from '../db/data-model.cds';
using TargetModels as _targetmodels from '../db/data-model.cds';
using CVD_HANA_MODELS as _newModels  from '../db/data-model.cds';
using CVD_MODEL_FIELDS as _modelFields from '../db/data-model.cds';
using { cuid } from '@sap/cds/common';


service FormulaModelerServices {

    // Maintain Formulae
    entity Formulae      as projection on _formulae;
    // Maintain FormulaModels
    entity FormulaModels as projection on _formulamodels;
    // Maintain TargetModels
    entity TargetModels  as projection on _targetmodels;
    // Main service to lookup new models
    entity NewModels as projection on _newModels;
    // Service to know the fields of the models
    entity ModelFields as projection on _modelFields;

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
    // Perform data preview of a formula
    action previewFormulaData(formulaID: UUID) returns array of {};
}
 

service SandboxService {
    action createFormula(title : String, description : String, formula : String, modelAliases : array of String);
}

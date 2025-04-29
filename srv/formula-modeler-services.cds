using Formulae as _formulae from '../db/data-model.cds';
using FormulaModels as _formulamodels from '../db/data-model.cds';
using TargetModels as _targetmodels from '../db/data-model.cds';

service FormulaModelerServices {
    // Maintain Formulae
    entity Formulae as projection on  _formulae;
    // Maintain FormulaModels
    entity FormulaModels as projection on _formulamodels;
    // Maintain TargetModels
    entity TargetModels as projection on _targetmodels;
    // Retrieve SQL for a given formula
    action executeSQL(formulaID: UUID, params: String) returns array of String;
    // action executeSQL(formulaID: UUID ) returns String;

}   
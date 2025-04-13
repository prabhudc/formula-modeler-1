using Formulae as formulae from '../db/data-model.cds';


service FormulaModelerServices {
    // Maintain Formulae
    entity Formulae as projection on  formulae;
    // Retrieve SQL for a given formula
    action executeSQL(formulaID: UUID, params: String) returns array of String;
    // action executeSQL(formulaID: UUID ) returns String;

}   
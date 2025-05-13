using { cuid, managed } from '@sap/cds/common';

entity Formulae : cuid, managed {
    title : String(255);
    description : String(255);
    formula : LargeString;
    Models : Composition of many FormulaModels on Models.parent = $self;
}

entity FormulaModels  {
    key parent : Association to Formulae;
    key modelID : UUID; 
    modelAlias : Association to TargetModels;
}

entity TargetModels: cuid, managed {
    targetModel : LargeString;
    schemaName : String(255);
    modelAlias : String(255);
}

entity ModelRelationships : cuid, managed {
    sourceModelAlias : Association to TargetModels;
    targetModelAlias : Association to TargetModels;
    relationshipType : String(255); // LEFT OUTER JOIN, INNER JOIN, RIGHT OUTER JOIN
    relationshipAttributes : Association to many  ModelRelationshipAttributes on relationshipAttributes.relationship = $self;
}

entity ModelRelationshipAttributes : cuid, managed {
    relationship : Association to ModelRelationships;
    leftAttribute : String(255);
    rightAttribute : String(255);
}

// Graph setup
// Vertices of the Graph
entity Nodes : cuid {
    node_is_root : Boolean;
    node_is_leaf : Boolean;
    node_operator : String(5);
    node_operand : String(255);
    node_formula : String(255);
}

// Edges of the Graph
entity Edges : cuid {
    start : Association to Nodes not null;
    end : Association to Nodes not null;
    edge_location : String(1) @assert.range: ['l', 'n', 'r'];
}
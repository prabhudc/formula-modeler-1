using { cuid, managed } from '@sap/cds/common';

entity Formulae : cuid, managed {
    title : String(255);
    description : String(255);
    formula : LargeString;
    dataRetrievalProxyObject : String(255);
    isValid : Boolean default false;
    Nodes : Composition of many Nodes on Nodes.formula = $self;
    Edges : Composition of many Edges on Edges.formula = $self;
    Models : Composition of many FormulaModels on Models.parent = $self;
    virtual KeyAttributes : array of  LargeString;
}

// Graph setup
// Vertices of the Graph
entity Nodes  : cuid {
    node_is_root : Boolean default false;
    node_is_leaf : Boolean default false;
    node_is_constant : Boolean default false;
    node_is_variable : Boolean default false;
    node_operator : String(10) default '';
    node_operand : String(255) default '';
    node_formula : String(255) default '';
    Parameters : Composition of many Parameters on Parameters.node = $self;
    formula : Association to Formulae;
}

// Edges of the Graph
entity Edges : cuid {
    start : Association to Nodes not null;
    end : Association to Nodes not null;
    edge_location : String(1) @assert.range: ['l', 'n', 'r'];
    formula : Association to Formulae;
}
// One or more modeles used in a formula 
entity FormulaModels  {
    key parent : Association to Formulae;
    key model : Association to TargetModels; 
}

// Parameters applicable to a node
entity Parameters : cuid {
    node : Association to Nodes;
    parameter_name : String(255);
    parameter_value : String(255);
    parameter_type : String(255); 
    is_parameter_enabled : Boolean default true;
}

@assert.unique: {unique_model_alias: [modelAlias]} 
entity TargetModels: cuid, managed {
    targetModel : String(255);
    schemaName : String(255);
    modelAlias : String(255);// Alias understandable to the user
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
    // modelAlias : Association to TargetModels;
}

@cds.persistence.exists
entity CVD_HANA_MODELS {
    key SCHEMA_NAME : String(255);
    key VIEW_NAME : String(255);
        MODELALIAS : String(255);
}



@cds.persistence.exists
entity CVD_MODEL_FIELDS {
    key         ID : String(255);
    key  COLUMN_NAME : String(255);
        TARGETMODEL : String(255);
        ATTRIBUTE_TYPE: String(10);
        MODELALIAS : String(255);
}
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Button",
    "sap/m/ColumnListItem",
    "sap/m/Text"
], function(Controller, Button, ColumnListItem, Text) {
    "use strict";

    return Controller.extend("fm.editor.controller.FMMaintenanceView", {
        onInit: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("maintenance").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function(oEvent) {
            var formulaId = oEvent.getParameter("arguments").formulaId;
            var oTable = this.byId("targetModelsSelectedTable");
            var oView = this.getView();
            var oModel = this.getView().getModel();

            // Bind FormulaModels table for this formulaId
            oTable.bindItems({
                path: "/FormulaModels",
                parameters: {
                    $expand: "model",
                    $filter: "parent_ID eq '" + formulaId + "'"
                },
                template: new sap.m.ColumnListItem({
                    cells: [
                        new Text({ text: "{model/targetModel}" }),
                        new Text({ text: "{model/schemaName}" }),
                        new Text({ text: "{model/modelAlias}" })
                    ]
                })
            });

            // Bind formula header fields to the Formulae entity filtered by ID
            var sFormulaPath = "/Formulae('" + formulaId + "')";
            var oHeaderVBox = oView.byId("formulaHeaderFieldsMaintenance");
            if (oHeaderVBox) {
                oHeaderVBox.bindElement({ path: sFormulaPath });
            }

            // Query Formulae entity to retrieve the formula field and update the code editor
            var oFormulaBinding = oModel.bindContext(sFormulaPath);
            oFormulaBinding.requestObject().then(function(oData) {
                var sFormulaContent = oData.formula;
                var oCodeEditor = oView.byId("formulaCodeEditorMaintenanceView");
                if (oCodeEditor) {
                    oCodeEditor.setValue(sFormulaContent || ""); // Set formula content or empty string if undefined
                }
            }).catch(function(oError) {
                console.error("Error retrieving formula content:", oError);
            });

            // Step 1: Query Nodes entity to retrieve the ID of the record where node_is_root is true
            var sNodesPath = "/Nodes";
            var oBinding = oModel.bindList(sNodesPath, undefined, undefined, [
                new sap.ui.model.Filter("formula_ID", sap.ui.model.FilterOperator.EQ, formulaId),
                new sap.ui.model.Filter("node_is_root", sap.ui.model.FilterOperator.EQ, true)
            ]);

            oBinding.requestContexts().then(function(aContexts) {
                if (aContexts.length === 1) {
                    var sNodeId = aContexts[0].getProperty("ID");

                    // Step 2: Query Parameters entity using the retrieved node ID
                    var sParametersPath = "/Parameters";
                    var oParamBinding = oModel.bindList(sParametersPath, undefined, undefined, [
                        new sap.ui.model.Filter("node_ID", sap.ui.model.FilterOperator.EQ, sNodeId),
                        new sap.ui.model.Filter("parameter_type", sap.ui.model.FilterOperator.EQ, "formula_dimension"),
                        new sap.ui.model.Filter("parameter_name", sap.ui.model.FilterOperator.EQ, "key")
                    ]);

                    oParamBinding.requestContexts().then(function(aParamContexts) {
                        var aParameterValues = aParamContexts.map(function(oContext) {
                            return oContext.getProperty("parameter_value");
                        });

                        // Step 3: Add buttons to the HBox with the retrieved parameter values
                        var oHBox = oView.byId("keyFieldsButtonsContainerMaintenanceView");
                        oHBox.removeAllItems(); // Clear existing buttons

                        aParameterValues.forEach(function(sValue) {
                            var oButton = new sap.m.Button({
                                text: sValue,
                                emphasized: true
                            });
                            oHBox.addItem(oButton);
                        });
                    });
                } else {
                    console.error("No root node found or multiple root nodes exist for formulaId:", formulaId);
                }
            }).catch(function(oError) {
                console.error("Error retrieving nodes:", oError);
            });
        },

        onReturnToLanding: function() {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("landing");
        }
    });
});
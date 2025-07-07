sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/ColumnListItem",
    "sap/m/Text"
], function(Controller, ColumnListItem, Text) {
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

            // Bind FormulaModels table for this formulaId
            oTable.bindItems({
                path: "/FormulaModels",
                parameters: {
                    $expand: "model",
                    $filter: "parent_ID eq '" + formulaId + "'"
                },
                template: new ColumnListItem({
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
        },
        onReturnToLanding: function() {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("landing");
        }
    });
});
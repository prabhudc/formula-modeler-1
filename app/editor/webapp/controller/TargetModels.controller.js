sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/ColumnListItem",
    "sap/m/Text"
], function(Controller, ColumnListItem, Text) {
    "use strict";
    return Controller.extend("fm.editor.controller.TargetModels", {
        onInit: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("targetModels").attachPatternMatched(this._onRouteMatched, this);
        },
        _onRouteMatched: function(oEvent) {
            var formulaId = oEvent.getParameter("arguments").formulaId;
            var oTable = this.byId("targetModelsNavTable");

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
        },
        onReturnToLandingFromTargetModels: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("landing");
        }
    });
});
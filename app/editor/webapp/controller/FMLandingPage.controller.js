sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox"
], function(Controller, MessageBox) {
    "use strict";
    return Controller.extend("fm.editor.controller.FMLandingPage", {
        _editMode: false,
        onNavigateToEditor: function () {
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("editor");
        },
        onToggleEditMode: function () {
            var oTable = this.byId("formulaeTable");
            var oDeleteBtn = this.byId("deleteFormulaButton");
            this._editMode = !this._editMode;
            if (this._editMode) {
                oTable.setMode("MultiSelect");
                oDeleteBtn.setEnabled(false);
            } else {
                oTable.removeSelections();
                oTable.setMode("None");
                oDeleteBtn.setEnabled(false);
            }
        },
        onFormulaSelectionChange: function(oEvent) {
            var oTable = this.byId("formulaeTable");
            var oDeleteBtn = this.byId("deleteFormulaButton");
            var aSelected = oTable.getSelectedItems();
            oDeleteBtn.setEnabled(aSelected.length > 0);
        },
        onDeleteSelectedFormula: function() {
            var oTable = this.byId("formulaeTable");
            var aSelected = oTable.getSelectedItems();
            var oModel = this.getView().getModel();
            var that = this;
            if (aSelected.length === 0) return;
            MessageBox.confirm("Are you sure you want to delete the selected formulae?", {
                onClose: function(oAction) {
                    if (oAction === MessageBox.Action.OK) {
                        aSelected.forEach(function(oItem) {
                            var sId = oItem.getBindingContext().getProperty("ID");
                            oModel.delete("/Formulae('" + sId + "')")
                                .then(function() {
                                    oTable.removeItem(oItem);
                                })
                                .catch(function() {
                                    MessageBox.error("Failed to delete formula with ID: " + sId);
                                });
                        });
                        that.byId("deleteFormulaButton").setEnabled(false);
                    }
                }
            });
        },
        onFormulaPress: function(oEvent) {
            if (this._editMode) return; // Disable navigation in edit mode
            var oItem = oEvent.getSource();
            var oCtx = oItem.getBindingContext();
            var formulaId = oCtx.getProperty("ID");
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.navTo("targetModels", { formulaId: formulaId });
        }
    });
});
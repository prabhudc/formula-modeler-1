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
        },
        onCopyFormulaId: function(oEvent) {
            var oItem = oEvent.getSource().getParent();
            var oCtx = oItem.getBindingContext();
            var formulaId = oCtx.getProperty("ID");
            if (navigator.clipboard) {
                navigator.clipboard.writeText(formulaId);
            } else {
                // fallback for older browsers
                var tempInput = document.createElement("input");
                tempInput.value = formulaId;
                document.body.appendChild(tempInput);
                tempInput.select();
                document.execCommand("copy");
                document.body.removeChild(tempInput);
            }
            sap.m.MessageToast.show("Formula ID copied to clipboard");
        },
        onPreviewFormulaData: function(oEvent) {
            var oItem = oEvent.getSource().getParent();
            var oCtx = oItem.getBindingContext();
            var formulaId = oCtx.getProperty("ID");
            var oView = this.getView();
            var oModel = oView.getModel();
            var that = this;

            // Load fragment if not already loaded
            if (!this._oPreviewDialog) {
                sap.ui.core.Fragment.load({
                    name: "fm.editor.view.PreviewDialog",
                    controller: this
                }).then(function(oDialog){
                    that._oPreviewDialog = oDialog;
                    oView.addDependent(oDialog);
                    that._showPreviewData(formulaId);
                });
            } else {
                that._showPreviewData(formulaId);
            }
        },

        _showPreviewData: function(formulaId) {
            var oView = this.getView();
            var oModel = oView.getModel();
            var that = this;

            var oPreviewContext = oModel.bindContext("/previewFormulaData(...)");
            oPreviewContext.setParameter("formulaID", formulaId);

            oPreviewContext.execute().then(function() {
                oPreviewContext.requestObject().then(function(oResult) {
                    var aData = (oResult && oResult.value) ? oResult.value : [];
                    var oVBox = that._oPreviewDialog.getContent()[0];

                    oVBox.removeAllItems();

                    if (!aData.length) {
                        oVBox.addItem(new sap.m.Text({ text: "No preview data available." }));
                        that._oPreviewDialog.open();
                        return;
                    }

                    // Collect all unique keys except O_CALCULATED
                    var aColumns = [];
                    aData.forEach(function(row) {
                        Object.keys(row).forEach(function(key) {
                            if (key !== "O_CALCULATED" && aColumns.indexOf(key) === -1) {
                                aColumns.push(key);
                            }
                        });
                    });
                    aColumns.push("O_CALCULATED");

                    // Create table
                    var oTable = new sap.m.Table({
                        columns: aColumns.map(function(col) {
                            return new sap.m.Column({
                                header: new sap.m.Text({ text: col })
                            });
                        })
                    });

                    aData.forEach(function(row) {
                        var aCells = aColumns.map(function(col) {
                            return new sap.m.Text({ text: row[col] });
                        });
                        oTable.addItem(new sap.m.ColumnListItem({ cells: aCells }));
                    });

                    oVBox.addItem(oTable);
                    that._oPreviewDialog.open();
                });
            }).catch(function(oError) {
                sap.m.MessageToast.show("Preview failed.");
            });
        },

        onClosePreviewDialog: function() {
            if (this._oPreviewDialog) {
                this._oPreviewDialog.close();
            }
        }
    });
});
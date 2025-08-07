import React, { useState, useRef } from "react";
import {
  IonPopover,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonAlert,
  IonToast,
  IonInput,
  IonButton,
  IonModal,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSpinner,
} from "@ionic/react";
import {
  addOutline,
  arrowUndo,
  arrowRedo,
  ellipsisVertical,
  saveOutline,
  documentOutline,
  imageOutline,
  trashOutline,
  close,
  image,
  closeCircle,
  key,
  cameraOutline,
  createOutline,
  checkmark,
} from "ionicons/icons";
import * as AppGeneral from "../socialcalc/index.js";
import { File } from "../Storage/LocalStorage.js";
import { DATA } from "../../app-data.js";
import { useInvoice } from "../../contexts/InvoiceContext.js";
import { formatDateForFilename } from "../../utils/helper.js";
import { useTheme } from "../../contexts/ThemeContext.js";
import { Camera, CameraResultType, CameraSource } from "@capacitor/camera";
import {
  isQuotaExceededError,
  getQuotaExceededMessage,
} from "../../utils/helper.js";

interface FileOptionsProps {
  showActionsPopover: boolean;
  setShowActionsPopover: (show: boolean) => void;
}

const FileOptions: React.FC<FileOptionsProps> = ({
  showActionsPopover,
  setShowActionsPopover,
}) => {
  const { isDarkMode } = useTheme();
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [showUnsavedChangesAlert, setShowUnsavedChangesAlert] = useState(false);
  const [showSaveAsAlert, setShowSaveAsAlert] = useState(false);
  const [newFileName, setNewFileName] = useState("");
  const [showLogoAlert, setShowLogoAlert] = useState(false);
  const [device] = useState(AppGeneral.getDeviceType());
  const actionsPopoverRef = useRef<HTMLIonPopoverElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Signature modal state
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [userSignatures, setUserSignatures] = useState<
    Array<{ id: string; data: string; name: string }>
  >([]);
  const [isLoadingSignatures, setIsLoadingSignatures] = useState(false);
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null);

  const { selectedFile, updateSelectedFile, store } = useInvoice();

  const handleUndo = () => {
    AppGeneral.undo();
    setShowActionsPopover(false);
  };

  const handleRedo = () => {
    AppGeneral.redo();
    setShowActionsPopover(false);
  };

  const _validateName = (filename: string) => {
    if (!filename.trim()) {
      setToastMessage("File name cannot be empty");
      setShowToast(true);
      return false;
    }
    return true;
  };

  const _checkForExistingFile = async (filename: string) => {
    try {
      const existingFile = await store._checkKey(filename);
      if (existingFile) {
        setToastMessage("File already exists. Please choose a different name.");
        setShowToast(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error checking for existing file:", error);
      return false;
    }
  };

  const doSaveAs = async (filename: string) => {
    try {
      if (_validateName(filename)) {
        // Check if file already exists
        const exists = await _checkForExistingFile(filename);
        if (exists) return;

        setToastMessage("Saving file...");
        setShowToast(true);

        const content = AppGeneral.getSpreadsheetContent();
        const now = new Date().toISOString();

        const file = new File(
          now,
          now,
          encodeURIComponent(content),
          filename,
          1
        );
        await store._saveFile(file);

        setToastMessage("File saved successfully!");
        setShowToast(true);
        updateSelectedFile(filename);
      }
    } catch (error) {
      console.error("Error saving file:", error);

      if (isQuotaExceededError(error)) {
        setToastMessage(getQuotaExceededMessage("saving file"));
      } else {
        setToastMessage("Failed to save file. Please try again.");
      }
      setShowToast(true);
    }
  };

  const handleSaveAs = () => {
    setShowActionsPopover(false);
    setNewFileName("");
    setShowSaveAsAlert(true);
  };

  const doSave = async () => {
    try {
      setToastMessage("Saving...");
      setShowToast(true);

      const content = AppGeneral.getSpreadsheetContent();

      if (selectedFile === "default") {
        // Save as new file
        const now = new Date().toISOString();
        const filename = "Untitled-" + formatDateForFilename(new Date());
        const file = new File(
          now,
          now,
          encodeURIComponent(content),
          filename,
          1
        );
        await store._saveFile(file);
        updateSelectedFile(filename);
        setToastMessage("File saved as " + filename);
      } else {
        // Update existing file
        const existingFile = await store._getFile(selectedFile);
        const now = new Date().toISOString();
        const updatedFile = new File(
          existingFile.created,
          now,
          encodeURIComponent(content),
          selectedFile,
          existingFile.billType,
          existingFile.isEncrypted
        );
        await store._saveFile(updatedFile);
        setToastMessage("File saved successfully!");
      }
      setShowToast(true);
    } catch (error) {
      console.error("Error saving file:", error);

      if (isQuotaExceededError(error)) {
        setToastMessage(getQuotaExceededMessage("saving file"));
      } else {
        setToastMessage("Failed to save file. Please try again.");
      }
      setShowToast(true);
    }
  };

  const handleSave = () => {
    setShowActionsPopover(false);
    doSave();
  };

  const handleNew = () => {
    setShowActionsPopover(false);
    setShowUnsavedChangesAlert(true);
  };

  const doNewFile = () => {
    // Clear the spreadsheet
    DATA["home"][device]["msc"] = {};

    // Reload the workbook with empty data
    if (typeof window !== "undefined" && (window as any).SocialCalc) {
      (window as any).SocialCalc.WorkBookControlLoad(DATA["home"][device]);
    }

    updateSelectedFile("default");
    setToastMessage("New file created");
    setShowToast(true);
  };

  const handleAddImage = () => {
    setShowActionsPopover(false);
    fileInputRef.current?.click();
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageUrl = e.target?.result as string;
        if (imageUrl) {
          // Get current selected cell
          const currentCell = getCurrentSelectedCell();
          if (currentCell) {
            AppGeneral.addLogo(currentCell, imageUrl);
            setToastMessage("Image added successfully!");
            setShowToast(true);
          } else {
            setToastMessage("Please select a cell first");
            setShowToast(true);
          }
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const getCurrentSelectedCell = (): string | null => {
    // This would typically get the currently selected cell from the spreadsheet
    // For now, return a default cell
    return "A1";
  };

  const handleTakePhoto = async () => {
    setShowActionsPopover(false);
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      if (image.dataUrl) {
        const currentCell = getCurrentSelectedCell();
        if (currentCell) {
          AppGeneral.addLogo(currentCell, image.dataUrl);
          setToastMessage("Photo added successfully!");
          setShowToast(true);
        } else {
          setToastMessage("Please select a cell first");
          setShowToast(true);
        }
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      setToastMessage("Failed to take photo");
      setShowToast(true);
    }
  };

  const handleRemoveImage = () => {
    setShowActionsPopover(false);
    const currentCell = getCurrentSelectedCell();
    if (currentCell) {
      AppGeneral.removeLogo(currentCell);
      setToastMessage("Image removed successfully!");
      setShowToast(true);
    } else {
      setToastMessage("Please select a cell with an image first");
      setShowToast(true);
    }
  };

  return (
    <>
      {/* Actions Popover */}
      <IonPopover
        ref={actionsPopoverRef}
        isOpen={showActionsPopover}
        onDidDismiss={() => setShowActionsPopover(false)}
        trigger="actions-trigger"
        side="end"
        alignment="end"
      >
        <IonContent>
          <IonList>
            <IonItem button onClick={handleNew}>
              <IonIcon icon={addOutline} slot="start" />
              <IonLabel>New</IonLabel>
            </IonItem>

            <IonItem button onClick={handleSave}>
              <IonIcon icon={saveOutline} slot="start" />
              <IonLabel>Save</IonLabel>
            </IonItem>

            <IonItem button onClick={handleSaveAs}>
              <IonIcon icon={documentOutline} slot="start" />
              <IonLabel>Save As</IonLabel>
            </IonItem>

            <IonItem button onClick={handleUndo}>
              <IonIcon icon={arrowUndo} slot="start" />
              <IonLabel>Undo</IonLabel>
            </IonItem>

            <IonItem button onClick={handleRedo}>
              <IonIcon icon={arrowRedo} slot="start" />
              <IonLabel>Redo</IonLabel>
            </IonItem>

            <IonItem button onClick={handleAddImage}>
              <IonIcon icon={imageOutline} slot="start" />
              <IonLabel>Add Image</IonLabel>
            </IonItem>

            <IonItem button onClick={handleTakePhoto}>
              <IonIcon icon={cameraOutline} slot="start" />
              <IonLabel>Take Photo</IonLabel>
            </IonItem>

            <IonItem button onClick={handleRemoveImage}>
              <IonIcon icon={trashOutline} slot="start" />
              <IonLabel>Remove Image</IonLabel>
            </IonItem>
          </IonList>
        </IonContent>
      </IonPopover>

      {/* Hidden file input for image upload */}
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        style={{ display: "none" }}
        onChange={handleImageUpload}
      />

      {/* Unsaved Changes Alert */}
      <IonAlert
        isOpen={showUnsavedChangesAlert}
        onDidDismiss={() => setShowUnsavedChangesAlert(false)}
        header="Unsaved Changes"
        message="You have unsaved changes. Do you want to continue without saving?"
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            cssClass: "secondary",
          },
          {
            text: "Continue",
            handler: doNewFile,
          },
        ]}
      />

      {/* Save As Alert */}
      <IonAlert
        isOpen={showSaveAsAlert}
        onDidDismiss={() => setShowSaveAsAlert(false)}
        header="Save As"
        inputs={[
          {
            name: "filename",
            type: "text",
            placeholder: "Enter filename",
            value: newFileName,
          },
        ]}
        buttons={[
          {
            text: "Cancel",
            role: "cancel",
            cssClass: "secondary",
          },
          {
            text: "Save",
            handler: (data) => {
              if (data.filename?.trim()) {
                doSaveAs(data.filename.trim());
              }
            },
          },
        ]}
      />

      {/* Toast for notifications */}
      <IonToast
        isOpen={showToast}
        message={toastMessage}
        duration={3000}
        onDidDismiss={() => setShowToast(false)}
        position="bottom"
      />
    </>
  );
};

export default FileOptions;

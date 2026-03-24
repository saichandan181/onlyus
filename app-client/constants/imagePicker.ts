import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';

const iosLibraryBase =
  Platform.OS === 'ios'
    ? {
        shouldDownloadFromNetwork: true,
        preferredAssetRepresentationMode:
          ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Compatible,
      }
    : {};

/**
 * iOS: PHPhotosErrorDomain 3164 often means the asset needs iCloud download.
 * Allow network + compatible representation so readAsStringAsync succeeds.
 */
export const IOS_PHOTO_LIBRARY_OPTIONS: Partial<ImagePicker.ImagePickerOptions> = iosLibraryBase;

/**
 * iOS video: default export is effectively Passthrough / original, which keeps many
 * iCloud-only assets as references — export then fails with 3164 inside the picker.
 * MediumQuality forces a local H.264/AAC export so a real file path is returned.
 * (Expo: non-Passthrough presets pull from iCloud automatically.)
 */
export const IOS_VIDEO_LIBRARY_OPTIONS: Partial<ImagePicker.ImagePickerOptions> =
  Platform.OS === 'ios'
    ? {
        ...iosLibraryBase,
        videoExportPreset: ImagePicker.VideoExportPreset.MediumQuality,
      }
    : {};

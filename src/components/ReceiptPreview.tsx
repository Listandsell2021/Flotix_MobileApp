import React from 'react';
import { View, Text, Image, StyleSheet, TouchableOpacity, Modal, ScrollView } from 'react-native';
import { theme } from '../styles/theme';
import Icon from './Icon';

interface ReceiptPreviewProps {
  uri: string;
  onPress?: () => void;
  style?: any;
  showFullSize?: boolean;
}

interface ReceiptModalProps {
  visible: boolean;
  uri: string;
  onClose: () => void;
}

const ReceiptModal: React.FC<ReceiptModalProps> = ({ visible, uri, onClose }) => {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.modalOverlay} onPress={onClose} />
        <View style={styles.modalContent}>
          <ScrollView 
            contentContainerStyle={styles.scrollContainer}
            maximumZoomScale={3}
            minimumZoomScale={1}
          >
            <Image source={{ uri }} style={styles.fullImage} resizeMode="contain" />
          </ScrollView>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Icon name="close" size={18} color={theme.colors.surface} />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const ReceiptPreview: React.FC<ReceiptPreviewProps> = ({ 
  uri, 
  onPress, 
  style,
  showFullSize = false 
}) => {
  const [showModal, setShowModal] = React.useState(false);

  const handlePress = () => {
    if (showFullSize) {
      setShowModal(true);
    } else if (onPress) {
      onPress();
    }
  };

  return (
    <>
      <TouchableOpacity 
        style={[styles.container, style]} 
        onPress={handlePress}
        activeOpacity={0.8}
      >
        <Image source={{ uri }} style={styles.image} />
        {showFullSize && (
          <View style={styles.overlay}>
            <Text style={styles.overlayText}>Tap to view full size</Text>
          </View>
        )}
      </TouchableOpacity>

      {showFullSize && (
        <ReceiptModal 
          visible={showModal} 
          uri={uri} 
          onClose={() => setShowModal(false)} 
        />
      )}
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: theme.borderRadius.medium,
    overflow: 'hidden',
    backgroundColor: theme.colors.surface,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.22,
    shadowRadius: 2.22,
  },
  image: {
    width: '100%',
    height: 120,
  },
  overlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: theme.spacing.xs,
    alignItems: 'center',
  },
  overlayText: {
    color: theme.colors.surface,
    fontSize: theme.fontSize.small,
    fontWeight: '500',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContent: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: theme.spacing.xl,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullImage: {
    width: '90%',
    height: '100%',
    maxHeight: 600,
  },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 20,
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: theme.colors.surface,
    fontSize: 18,
    fontWeight: 'bold',
  },
});

export default ReceiptPreview;
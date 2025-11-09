'use client'

import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from '@nextui-org/modal'
import { Button } from '@nextui-org/button'

interface ArmWarningModalProps {
  isOpen: boolean
  onOpenChange: () => void
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmText: string
}

export function ArmWarningModal({
  isOpen,
  onOpenChange,
  title,
  message,
  onConfirm,
  onCancel,
  confirmText,
}: ArmWarningModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onCancel} onOpenChange={onOpenChange}>
      <ModalContent>
        {(onClose) => (
          <>
            <ModalHeader>{title}</ModalHeader>
            <ModalBody>
              <p>{message}</p>
            </ModalBody>
            <ModalFooter>
              <Button
                variant="light"
                onPress={() => {
                  onCancel()
                  onClose()
                }}
              >
                Go back
              </Button>
              <Button
                color="danger"
                onPress={() => {
                  onConfirm()
                  onClose()
                }}
              >
                {confirmText}
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  )
}

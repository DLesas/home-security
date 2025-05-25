import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { authClient } from '../lib/auth';

export const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [showEmailPassword, setShowEmailPassword] = useState(false);

    // Check if passkey is available on this device
    useEffect(() => {
        const checkPasskey = async () => {
            const { isSupported } = await authClient.getBiometricInfo();
            if (isSupported) {
                try {
                    setIsLoading(true);
                    const { data, error } = await authClient.authenticateWithPasskey();
                    if (error) {
                        setShowEmailPassword(true);
                    }
                } catch (error) {
                    setShowEmailPassword(true);
                } finally {
                    setIsLoading(false);
                }
            } else {
                setShowEmailPassword(true);
            }
        };
        checkPasskey();
    }, []);

    const handleEmailPasswordLogin = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await authClient.signIn.email({
                email,
                password,
            });

            if (error) {
                Alert.alert('Login Error', error.message);
                return;
            }

            Alert.alert('Success', 'Logged in successfully!');
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    if (!showEmailPassword) {
        return (
            <View className="p-4">
                <Text className="text-2xl font-bold mb-4">Sign In with Passkey</Text>
                <Text className="mb-4">Please use your device's biometric authentication to sign in.</Text>
                {isLoading && <Text>Loading...</Text>}
            </View>
        );
    }

    return (
        <View className="p-4">
            <Text className="text-2xl font-bold mb-4">Sign In</Text>
            
            <TextInput
                className="border p-2 mb-4 rounded"
                placeholder="Email"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
            />
            
            <TextInput
                className="border p-2 mb-4 rounded"
                placeholder="Password"
                value={password}
                onChangeText={setPassword}
                secureTextEntry
            />
            
            <Button
                title={isLoading ? "Signing in..." : "Sign In"}
                onPress={handleEmailPasswordLogin}
                disabled={isLoading}
            />
        </View>
    );
}; 
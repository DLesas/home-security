import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { authClient } from '../lib/auth';

export const Register = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleRegistration = async () => {
        try {
            setIsLoading(true);
            
            // First, register with email and password
            const { data: signUpData, error: signUpError } = await authClient.signUp.email({
                email,
                password,
                name,
            });

            if (signUpError) {
                Alert.alert('Registration Error', signUpError.message);
                return;
            }

            // After successful registration, set up passkey
            const { data: passkeyData, error: passkeyError } = await authClient.passkey.addPasskey({
                authenticatorAttachment: 'platform',
            });

            if (passkeyError) {
                Alert.alert('Passkey Setup Error', passkeyError.message);
                return;
            }

            Alert.alert('Success', 'Account created and passkey set up successfully!');
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <View className="p-4">
            <Text className="text-2xl font-bold mb-4">Create Account</Text>
            
            <TextInput
                className="border p-2 mb-4 rounded"
                placeholder="Name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
            />
            
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
                title={isLoading ? "Creating account..." : "Create Account"}
                onPress={handleRegistration}
                disabled={isLoading}
            />
        </View>
    );
}; 
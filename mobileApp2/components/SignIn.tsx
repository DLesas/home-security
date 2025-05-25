import React, { useState } from 'react';
import { View, Text, TextInput, Button, Alert } from 'react-native';
import { authClient } from '../lib/auth';

export const SignIn = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleEmailPasswordSignIn = async () => {
        try {
            setIsLoading(true);
            const { data, error } = await authClient.signIn.email({
                email,
                password,
            });

            if (error) {
                Alert.alert('Error', error.message);
                return;
            }

            // After successful email/password sign in, prompt for passkey
            const { data: passkeyData, error: passkeyError } = await authClient.passkey.addPasskey({
                authenticatorAttachment: 'platform',
            });

            if (passkeyError) {
                Alert.alert('Passkey Error', passkeyError.message);
                return;
            }

            // Successfully added passkey
            Alert.alert('Success', 'Passkey added successfully!');
        } catch (error) {
            Alert.alert('Error', 'An unexpected error occurred');
        } finally {
            setIsLoading(false);
        }
    };

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
                onPress={handleEmailPasswordSignIn}
                disabled={isLoading}
            />
        </View>
    );
}; 
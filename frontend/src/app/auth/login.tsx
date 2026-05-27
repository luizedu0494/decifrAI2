import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { globalStyles } from '../../styles/global';
import { authStyles } from '../../styles/auth';
import { login } from '../../services/auth';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin() {
    setError('');

    if (!email || !password) {
      setError('Preencha todos os campos.');
      return;
    }

    try {
      setLoading(true);
      await login(email, password);
      router.push('/home');
    } catch (err: any) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('E-mail ou senha incorretos.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else if (err.code === 'auth/too-many-requests') {
        setError('Muitas tentativas. Tente novamente mais tarde.');
      } else {
        setError('Erro ao entrar. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={globalStyles.container}>

      {/* Nome do app com destaque no "AI" */}
      <View style={authStyles.appNameContainer}>
        <Text style={authStyles.appNameText}>
          Decifr<Text style={authStyles.appNameHighlight}>AI</Text>
        </Text>
        <Text style={authStyles.appTagline}>Eu sei quem você está pensando...</Text>
      </View>

      <Image
        source={require('../../assets/genio_confiante.png')}
        style={authStyles.image}
        resizeMode="contain"
      />

      <Text style={globalStyles.title}>Entrar</Text>

      <View style={authStyles.form}>
        <TextInput
          style={authStyles.input}
          placeholder="E-mail"
          placeholderTextColor="#8d8d99"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        <TextInput
          style={authStyles.input}
          placeholder="Senha"
          placeholderTextColor="#8d8d99"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error ? <Text style={authStyles.error}>{error}</Text> : null}

        <TouchableOpacity
          style={authStyles.forgotPassword}
          onPress={() => router.push('/auth/forgot')}
        >
          <Text style={authStyles.forgotPasswordText}>Esqueci minha senha</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity
        style={globalStyles.button}
        onPress={handleLogin}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={globalStyles.buttonText}>Entrar</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.registerLink}
        onPress={() => router.push('/auth/register')}
      >
        <Text style={authStyles.registerLinkText}>
          Não tem conta? <Text style={authStyles.registerLinkBold}>Cadastre-se</Text>
        </Text>
      </TouchableOpacity>

    </View>
  );
}
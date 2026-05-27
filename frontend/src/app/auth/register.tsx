import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { globalStyles } from '../../styles/global';
import { authStyles } from '../../styles/auth';
import { register } from '../../services/auth';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleRegister() {
    setError('');

    if (!name || !email || !password || !confirmPassword) {
      setError('Preencha todos os campos.');
      return;
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.');
      return;
    }

    try {
      setLoading(true);
      await register(name, email, password);
      router.push('/home');
    } catch (err: any) {
      if (err.code === 'auth/email-already-in-use') {
        setError('Este e-mail já está em uso.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={globalStyles.container}>

      <Image
        source={require('../../assets/genio_confiante.png')}
        style={authStyles.image}
        resizeMode="contain"
      />

      <Text style={globalStyles.title}>Criar conta</Text>

      <View style={authStyles.form}>
        <TextInput
          style={authStyles.input}
          placeholder="Nome"
          placeholderTextColor="#8d8d99"
          autoCapitalize="words"
          value={name}
          onChangeText={setName}
        />

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

        <TextInput
          style={authStyles.input}
          placeholder="Confirmar senha"
          placeholderTextColor="#8d8d99"
          secureTextEntry
          value={confirmPassword}
          onChangeText={setConfirmPassword}
        />

        {error ? <Text style={authStyles.error}>{error}</Text> : null}
      </View>

      <TouchableOpacity
        style={globalStyles.button}
        onPress={handleRegister}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={globalStyles.buttonText}>Cadastrar</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.registerLink}
        onPress={() => router.push('/auth/login')}
      >
        <Text style={authStyles.registerLinkText}>
          Já tem conta? <Text style={authStyles.registerLinkBold}>Entrar</Text>
        </Text>
      </TouchableOpacity>

    </View>
  );
}
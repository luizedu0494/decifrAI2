import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { globalStyles } from '../../styles/global';
import { authStyles } from '../../styles/auth';
import { forgotPassword } from '../../services/auth';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  async function handleSend() {
    setError('');

    if (!email) {
      setError('Digite seu e-mail.');
      return;
    }

    try {
      setLoading(true);
      await forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      if (err.code === 'auth/user-not-found') {
        setError('Nenhuma conta encontrada com este e-mail.');
      } else if (err.code === 'auth/invalid-email') {
        setError('E-mail inválido.');
      } else {
        setError('Erro ao enviar e-mail. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <View style={globalStyles.container}>
        <Image
          source={require('../../assets/genio_confiante.png')}
          style={authStyles.image}
          resizeMode="contain"
        />
        <Text style={globalStyles.title}>E-mail enviado!</Text>
        <Text style={authStyles.sentText}>
          Verifique sua caixa de entrada e siga as instruções para redefinir sua senha.
        </Text>
        <TouchableOpacity
          style={globalStyles.button}
          onPress={() => router.push('/auth/login')}
        >
          <Text style={globalStyles.buttonText}>Voltar ao login</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={globalStyles.container}>

      <Image
        source={require('../../assets/genio_reflexivo.png')}
        style={authStyles.image}
        resizeMode="contain"
      />

      <Text style={globalStyles.title}>Esqueci minha senha</Text>

      <View style={authStyles.form}>
        <TextInput
          style={authStyles.input}
          placeholder="Digite seu e-mail"
          placeholderTextColor="#8d8d99"
          keyboardType="email-address"
          autoCapitalize="none"
          value={email}
          onChangeText={setEmail}
        />

        {error ? <Text style={authStyles.error}>{error}</Text> : null}
      </View>

      <TouchableOpacity
        style={globalStyles.button}
        onPress={handleSend}
        disabled={loading}
      >
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={globalStyles.buttonText}>Enviar</Text>
        }
      </TouchableOpacity>

      <TouchableOpacity
        style={authStyles.registerLink}
        onPress={() => router.push('/auth/login')}
      >
        <Text style={authStyles.registerLinkText}>
          Lembrei! <Text style={authStyles.registerLinkBold}>Voltar ao login</Text>
        </Text>
      </TouchableOpacity>

    </View>
  );
}
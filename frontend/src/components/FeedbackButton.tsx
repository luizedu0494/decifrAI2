import React, { useState } from 'react';
import { TouchableOpacity, Text, Modal, View, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { colors } from '../styles/global';
import { saveFeedbackInvalidQuestion } from '../services/feedbackService';
import { inferCategory } from '../services/groq';

interface FeedbackButtonProps {
  question: string;
  gameHistory?: { question: string; answer: string }[];
  aiReaction?: string;
  onFeedbackSent?: () => void;
}

export function FeedbackButton({ question, gameHistory = [], aiReaction, onFeedbackSent }: FeedbackButtonProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const [userComment, setUserComment] = useState('');
  const [userRating, setUserRating] = useState(0);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendFeedback = async () => {
    setSending(true);
    try {
      const category = inferCategory(gameHistory);
      await saveFeedbackInvalidQuestion({
        question,
        category: category || '',
        gameHistory,
        aiReaction,
        userRating,
        userComment,
      });
      setSent(true);
      setTimeout(() => {
        setModalVisible(false);
        setSent(false);
        setUserComment('');
        setUserRating(0);
        onFeedbackSent?.();
      }, 1500);
    } catch (err) {
      console.error('Erro ao enviar feedback:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <TouchableOpacity
        style={{
          backgroundColor: colors.warning,
          paddingHorizontal: 12,
          paddingVertical: 8,
          borderRadius: 6,
          marginTop: 8,
        }}
        onPress={() => {
          setSent(false);
          setModalVisible(true);
        }}
      >
        <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' }}>
          💡 Orientar IA
        </Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
        >
          <View
            style={{
              backgroundColor: '#fff',
              borderTopLeftRadius: 16,
              borderTopRightRadius: 16,
              padding: 20,
              maxHeight: '80%',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>
              Ajudar a IA
            </Text>

            <ScrollView>
              <Text style={{ fontSize: 14, marginBottom: 16, color: '#666' }}>
                A pergunta que a IA fez pode ser melhorada. Aqui estão algumas dicas:
              </Text>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8, color: colors.primary }}>
                  ❌ Pergunta Composta:
                </Text>
                <Text style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                  "{question}"
                </Text>
                <Text style={{ fontSize: 12, color: '#999' }}>
                  Perguntas com "ou" (como "É de filme ou série?") são compostas. A IA deveria fazer perguntas mais específicas.
                </Text>
              </View>

              <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', marginBottom: 8, color: colors.success }}>
                  ✅ Pergunta Melhor:
                </Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  Divida em duas perguntas:
                </Text>
                <Text style={{ fontSize: 12, color: '#999', marginTop: 4 }}>
                  • "É de um filme?"
                </Text>
                <Text style={{ fontSize: 12, color: '#999' }}>
                  • "É de uma série?"
                </Text>
              </View>

              <View style={{ marginBottom: 16, backgroundColor: '#f5f5f5', padding: 12, borderRadius: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8, color: '#333' }}>
                  📋 Regra de Ouro:
                </Text>
                <Text style={{ fontSize: 12, color: '#666' }}>
                  Toda pergunta deve ser respondível com SIM ou NÃO. Sem exceções!
                </Text>
              </View>
            </ScrollView>

            {!sent ? (
              <>
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8, color: '#333' }}>
                    📝 Comentário (opcional):
                  </Text>
                  <TextInput
                    style={{
                      borderWidth: 1,
                      borderColor: '#ddd',
                      borderRadius: 6,
                      padding: 10,
                      minHeight: 60,
                      textAlignVertical: 'top',
                      fontSize: 12,
                      color: '#333',
                    }}
                    placeholder="Descreva como a IA poderia melhorar..."
                    placeholderTextColor="#999"
                    multiline
                    value={userComment}
                    onChangeText={setUserComment}
                  />
                </View>

                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', marginBottom: 8, color: '#333' }}>
                    ⭐ Avaliação:
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {[1, 2, 3, 4, 5].map(star => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setUserRating(star)}
                        style={{ padding: 4 }}
                      >
                        <Text style={{ fontSize: 20 }}>
                          {star <= userRating ? '⭐' : '☆'}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 8,
                      backgroundColor: '#e0e0e0',
                    }}
                    onPress={() => setModalVisible(false)}
                    disabled={sending}
                  >
                    <Text style={{ textAlign: 'center', fontWeight: '600', color: '#333' }}>
                      Cancelar
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      borderRadius: 8,
                      backgroundColor: colors.primary,
                    }}
                    onPress={handleSendFeedback}
                    disabled={sending}
                  >
                    {sending ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={{ textAlign: 'center', fontWeight: '600', color: '#fff' }}>
                        Enviar Feedback
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            ) : (
              <View style={{ alignItems: 'center', paddingVertical: 20 }}>
                <Text style={{ fontSize: 24, marginBottom: 8 }}>✅</Text>
                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.success, textAlign: 'center' }}>
                  Obrigado! Seu feedback foi salvo e ajudará a IA a melhorar.
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

import React, { useRef, useState } from 'react';
import { View, Text, Image, FlatList, Dimensions, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { globalStyles } from '../styles/global';
import { onboardingStyles } from '../styles/onboarding';

const { width } = Dimensions.get('screen');

const slides = [
  {
    id: '1',
    image: require('../assets/genio_confiante.png'),
    title: 'Eu sei quem você está pensando!',
    description: 'Pense em qualquer personagem real ou fictício. Eu vou adivinhar quem é!',
  },
  {
    id: '2',
    image: require('../assets/genio_inquieto.png'),
    title: 'Responda minhas perguntas',
    description: 'Sim, Não, Talvez... Cada resposta me aproxima mais da sua resposta!',
  },
  {
    id: '3',
    image: require('../assets/genio_esnobe.png'),
    title: 'Acumule pontos e suba no ranking',
    description: 'Quanto mais você joga, mais pontos acumula. Será que consegue me enganar?',
  },
];

export default function Onboarding() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  function handleScroll(event: any) {
    const index = Math.round(event.nativeEvent.contentOffset.x / width);
    setCurrentIndex(index);
  }

  return (
    <View style={globalStyles.container}>

      <FlatList
        ref={flatListRef}
        data={slides}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={handleScroll}
        keyExtractor={(item) => item.id}
        style={{ width }}
        contentContainerStyle={{ alignItems: 'center' }}
        renderItem={({ item }) => (
          <View style={[onboardingStyles.slide, { width }]}>
            <Image
              source={item.image}
              style={onboardingStyles.image}
              resizeMode="contain"
            />
            <Text style={globalStyles.title}>{item.title}</Text>
            <Text style={onboardingStyles.description}>{item.description}</Text>
          </View>
        )}
      />

      <View style={onboardingStyles.dotsContainer}>
        {slides.map((_, i) => (
          <View
            key={i}
            style={[
              onboardingStyles.dot,
              i === currentIndex && onboardingStyles.dotActive,
            ]}
          />
        ))}
      </View>

      {currentIndex === slides.length - 1 ? (
        <TouchableOpacity
          style={globalStyles.button}
          onPress={() =>router.push('/auth/login')}
        >
          <Text style={globalStyles.buttonText}>Vamos começar!</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity onPress={() => router.push('/auth/login')}>
          <Text style={onboardingStyles.skip}>Pular</Text>
        </TouchableOpacity>
      )}

    </View>
  );
}
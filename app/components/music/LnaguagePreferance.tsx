import React, { useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { Check, Music, X } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const LanguagePreference = () => {
  const validLangs = [
    'hindi',
    'maithili',
    'bhojpuri',
    'english',
    'gujarati',
    'punjabi',
    'tamil',
    'telugu',
    'marathi',
    'bengali',
    'kannada',
    'malayalam',
    'urdu',
    'haryanvi',
    'rajasthani',
    'odia',
    'assamese',
  ];

  const [selectedLangs, setSelectedLangs] = useState(new Set(['hindi']));
  const [showAlert, setShowAlert] = useState(false);

  const handleLanguageToggle = (lang: string) => {
    setSelectedLangs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(lang)) {
        if (newSet.size > 1) {
          newSet.delete(lang);
        }
      } else {
        newSet.add(lang);
      }
      return newSet;
    });
  };

  const handleSkip = () => {
    setSelectedLangs(new Set(['hindi']));
    Alert.alert('Preferences reset to Hindi');
  };

  const handleContinue = () => {
    console.log('Selected languages:', Array.from(selectedLangs).join(', '));
    // Here you would navigate to the next screen
  };

  return (
    <SafeAreaView className='flex-1 bg-background'>
      <View className='flex-1 px-4 py-6'>
        {/* Header Section */}
        <View className='items-center mb-8'>
          <Text className='text-3xl font-bold'>Welcome to SyncVibe Music</Text>
          <Text className='text-gray-500 text-base mt-1'>Customize your musical journey</Text>
        </View>

        {/* Language Selection Area */}
        <View className='bg-white rounded-lg p-4 shadow-sm mb-6'>
          <View className='flex-row items-center mb-4'>
            <Music size={20} className='text-primary' />
            <Text className='text-xl font-semibold ml-2'>Choose Your Music Languages</Text>
          </View>

          <ScrollView className='h-96'>
            <View className='flex-row flex-wrap'>
              {validLangs.map((lang) => (
                <TouchableOpacity
                  key={lang}
                  onPress={() => handleLanguageToggle(lang)}
                  className={`m-1 p-4 rounded-lg border ${
                    selectedLangs.has(lang)
                      ? 'bg-blue-600 border-blue-600'
                      : 'bg-white border-gray-200'
                  }`}
                  style={{ width: '30%' }}
                >
                  <View className='flex-row justify-between items-center'>
                    <Text
                      className={`capitalize font-medium ${
                        selectedLangs.has(lang) ? 'text-white' : 'text-black'
                      }`}
                    >
                      {lang}
                    </Text>
                    {selectedLangs.has(lang) && <Check size={18} color='#fff' />}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>

        {/* Action Buttons */}
        <View className='flex-row justify-center space-x-4'>
          <TouchableOpacity
            onPress={handleSkip}
            className='bg-transparent border border-gray-300 rounded-lg py-3 px-6'
          >
            <Text className='text-center font-medium'>Skip</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={handleContinue} className='bg-blue-600 rounded-lg py-3 px-6'>
            <Text className='text-white text-center font-medium'>Continue</Text>
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

export default LanguagePreference;

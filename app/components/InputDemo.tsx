import React, { useState } from 'react';
import { View, Text, ScrollView } from 'react-native';
import { Input } from '@/components/ui/input';
import { useTheme } from '@/context/ThemeContext';
import { MaterialIcons } from '@expo/vector-icons';

const InputDemo = () => {
  const { colors } = useTheme();
  const [textValue, setTextValue] = useState('');
  const [emailValue, setEmailValue] = useState('');
  const [passwordValue, setPasswordValue] = useState('');
  const [errorValue, setErrorValue] = useState('');
  const [searchValue, setSearchValue] = useState('');

  return (
    <ScrollView className='flex-1 p-4' contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={{ color: colors.foreground }} className='text-xl font-bold mb-6'>
        Input Variants
      </Text>

      {/* Default variant */}
      <View className='mb-6'>
        <Text style={{ color: colors.foreground }} className='text-lg font-semibold mb-2'>
          Default
        </Text>
        <Input
          labelText='Name'
          placeholder='Enter your name'
          value={textValue}
          onChangeText={setTextValue}
        />
      </View>

      {/* Outline variant */}
      <View className='mb-6'>
        <Text style={{ color: colors.foreground }} className='text-lg font-semibold mb-2'>
          Outline
        </Text>
        <Input
          variant='outline'
          labelText='Email'
          placeholder='Enter your email'
          keyboardType='email-address'
          autoCapitalize='none'
          value={emailValue}
          onChangeText={setEmailValue}
          leftIcon={<MaterialIcons name='email' size={20} color={colors.mutedForeground} />}
        />
      </View>

      {/* Filled variant */}
      <View className='mb-6'>
        <Text style={{ color: colors.foreground }} className='text-lg font-semibold mb-2'>
          Filled
        </Text>
        <Input
          variant='filled'
          labelText='Password'
          placeholder='Enter your password'
          secureTextEntry
          value={passwordValue}
          onChangeText={setPasswordValue}
          leftIcon={<MaterialIcons name='lock' size={20} color={colors.mutedForeground} />}
          rightIcon={<MaterialIcons name='visibility' size={20} color={colors.mutedForeground} />}
        />
      </View>

      {/* Ghost variant */}
      <View className='mb-6'>
        <Text style={{ color: colors.foreground }} className='text-lg font-semibold mb-2'>
          Ghost
        </Text>
        <Input
          variant='ghost'
          labelText='Search'
          placeholder='Search something...'
          value={searchValue}
          onChangeText={setSearchValue}
          leftIcon={<MaterialIcons name='search' size={20} color={colors.mutedForeground} />}
          rightIcon={
            searchValue ? (
              <MaterialIcons name='close' size={20} color={colors.mutedForeground} />
            ) : null
          }
        />
      </View>

      {/* Sizes */}
      <Text style={{ color: colors.foreground }} className='text-xl font-bold mt-4 mb-6'>
        Input Sizes
      </Text>

      <View className='mb-6'>
        <Text style={{ color: colors.foreground }} className='text-lg font-semibold mb-2'>
          Small
        </Text>
        <Input
          variant='outline'
          size='sm'
          placeholder='Small input'
          leftIcon={<MaterialIcons name='person' size={16} color={colors.mutedForeground} />}
        />
      </View>

      <View className='mb-6'>
        <Text style={{ color: colors.foreground }} className='text-lg font-semibold mb-2'>
          Medium (default)
        </Text>
        <Input
          variant='outline'
          placeholder='Medium input'
          leftIcon={<MaterialIcons name='person' size={20} color={colors.mutedForeground} />}
        />
      </View>

      <View className='mb-6'>
        <Text style={{ color: colors.foreground }} className='text-lg font-semibold mb-2'>
          Large
        </Text>
        <Input
          variant='outline'
          size='lg'
          placeholder='Large input'
          leftIcon={<MaterialIcons name='person' size={24} color={colors.mutedForeground} />}
        />
      </View>

      {/* Error state */}
      <Text style={{ color: colors.foreground }} className='text-xl font-bold mt-4 mb-6'>
        Error State
      </Text>

      <View className='mb-6'>
        <Input
          variant='outline'
          labelText='Username'
          placeholder='Enter username'
          value={errorValue}
          onChangeText={setErrorValue}
          error={true}
          errorText='This username is already taken'
          leftIcon={<MaterialIcons name='error' size={20} color={colors.destructive} />}
        />
      </View>

      {/* Disabled state */}
      <Text style={{ color: colors.foreground }} className='text-xl font-bold mt-4 mb-6'>
        Disabled State
      </Text>

      <View className='mb-6'>
        <Input
          variant='outline'
          labelText='Disabled Input'
          placeholder='You cannot edit this field'
          value='Disabled content'
          editable={false}
          leftIcon={<MaterialIcons name='lock' size={20} color={colors.mutedForeground} />}
        />
      </View>
    </ScrollView>
  );
};

export default InputDemo;

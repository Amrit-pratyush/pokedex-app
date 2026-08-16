import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Image,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  StatusBar,
  TouchableOpacity,
  Modal,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';

// --- CONFIGURATION & CONSTANTS ---
const GENERATIONS = [
  { id: 1, name: 'Gen 1', region: 'Kanto', offset: 0, limit: 151 },
  { id: 2, name: 'Gen 2', region: 'Johto', offset: 151, limit: 100 },
  { id: 3, name: 'Gen 3', region: 'Hoenn', offset: 251, limit: 135 },
  { id: 4, name: 'Gen 4', region: 'Sinnoh', offset: 386, limit: 107 },
  { id: 5, name: 'Gen 5', region: 'Unova', offset: 493, limit: 156 },
  { id: 6, name: 'Gen 6', region: 'Kalos', offset: 649, limit: 72 },
  { id: 7, name: 'Gen 7', region: 'Alola', offset: 721, limit: 88 },
  { id: 8, name: 'Gen 8', region: 'Galar', offset: 809, limit: 96 },
  { id: 9, name: 'Gen 9', region: 'Paldea', offset: 905, limit: 120 },
];

const POKEMON_TYPES = [
  'all', 'grass', 'fire', 'water', 'electric', 'bug', 'normal',
  'poison', 'ground', 'fairy', 'fighting', 'psychic', 'rock',
  'ghost', 'ice', 'dragon', 'steel', 'dark', 'flying'
];

const TYPE_COLORS = {
  grass: '#78C850',
  fire: '#F08030',
  water: '#6890F0',
  bug: '#A8B820',
  normal: '#A8A878',
  poison: '#A040A0',
  electric: '#F8D030',
  ground: '#E0C068',
  fairy: '#EE99AC',
  fighting: '#C03028',
  psychic: '#F85888',
  rock: '#B8A038',
  ghost: '#705898',
  ice: '#98D8D8',
  dragon: '#7038F8',
  steel: '#B8B8D0',
  dark: '#705848',
  flying: '#A890F0',
};

const TYPE_CHART = {
  normal: { rock: 0.5, ghost: 0, steel: 0.5 },
  fire: { fire: 0.5, water: 0.5, grass: 2, ice: 2, bug: 2, rock: 0.5, dragon: 0.5, steel: 2 },
  water: { fire: 2, water: 0.5, grass: 0.5, ground: 2, rock: 2, dragon: 0.5 },
  electric: { water: 2, electric: 0.5, grass: 0.5, ground: 0, flying: 2, dragon: 0.5 },
  grass: { fire: 0.5, water: 2, grass: 0.5, poison: 0.5, ground: 2, flying: 0.5, bug: 0.5, rock: 2, dragon: 0.5, steel: 0.5 },
  ice: { fire: 0.5, water: 0.5, grass: 2, ice: 0.5, ground: 2, flying: 2, dragon: 2, steel: 0.5 },
  fighting: { normal: 2, ice: 2, poison: 0.5, flying: 0.5, psychic: 0.5, bug: 0.5, rock: 2, ghost: 0, dark: 2, steel: 2, fairy: 0.5 },
  poison: { grass: 2, poison: 0.5, ground: 0.5, rock: 0.5, ghost: 0.5, steel: 0, fairy: 2 },
  ground: { fire: 2, electric: 2, grass: 0.5, poison: 2, flying: 0, bug: 0.5, rock: 2, steel: 2 },
  flying: { electric: 0.5, grass: 2, fighting: 2, bug: 2, rock: 0.5, steel: 0.5 },
  psychic: { fighting: 2, poison: 2, psychic: 0.5, dark: 0, steel: 0.5 },
  bug: { fire: 0.5, grass: 2, fighting: 0.5, poison: 0.5, flying: 0.5, psychic: 2, ghost: 0.5, dark: 2, steel: 0.5, fairy: 0.5 },
  rock: { fire: 2, ice: 2, fighting: 0.5, ground: 0.5, flying: 2, bug: 2, steel: 0.5 },
  ghost: { normal: 0, psychic: 2, ghost: 2, dark: 0.5 },
  dragon: { dragon: 2, steel: 0.5, fairy: 0 },
  steel: { fire: 0.5, water: 0.5, electric: 0.5, ice: 2, rock: 2, steel: 0.5, fairy: 2 },
  dark: { fighting: 0.5, psychic: 2, ghost: 2, dark: 0.5, fairy: 0.5 },
  fairy: { fire: 0.5, fighting: 2, poison: 0.5, dragon: 2, dark: 2, steel: 0.5 },
};

const getTypeColor = (type) => TYPE_COLORS[type?.toLowerCase()] || '#94A3B8';
const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1).replace('-', ' ') : '');
const formatStatName = (name) => {
  const map = {
    hp: 'HP',
    attack: 'ATK',
    defense: 'DEF',
    'special-attack': 'Sp. ATK',
    'special-defense': 'Sp. DEF',
    speed: 'SPD',
  };
  return map[name] || name?.toUpperCase();
};

export default function App() {
  const [selectedGen, setSelectedGen] = useState(1);
  const [selectedType, setSelectedType] = useState('all');
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [favorites, setFavorites] = useState([]);
  
  const [pokemonList, setPokemonList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  
  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('about');
  const [isSpeaking, setIsSpeaking] = useState(false);

  useEffect(() => {
    loadFavorites();
  }, []);

  useEffect(() => {
    fetchGenerationPokemon(selectedGen);
  }, [selectedGen]);

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem('@pokedex_favorites');
      if (stored) setFavorites(JSON.parse(stored));
    } catch (e) {
      console.log('Error loading favorites:', e);
    }
  };

  const toggleFavorite = async (pokemonId) => {
    try {
      let updated;
      if (favorites.includes(pokemonId)) {
        updated = favorites.filter((id) => id !== pokemonId);
      } else {
        updated = [...favorites, pokemonId];
      }
      setFavorites(updated);
      await AsyncStorage.setItem('@pokedex_favorites', JSON.stringify(updated));
    } catch (e) {
      console.log('Error saving favorite:', e);
    }
  };

  const fetchGenerationPokemon = async (genId) => {
    setLoading(true);
    const gen = GENERATIONS.find((g) => g.id === genId);
    try {
      const res = await fetch(
        `https://pokeapi.co/api/v2/pokemon?limit=${gen.limit}&offset=${gen.offset}`
      );
      const data = await res.json();

      const detailedList = await Promise.all(
        data.results.map(async (poke) => {
          const detailRes = await fetch(poke.url);
          return await detailRes.json();
        })
      );

      setPokemonList(detailedList);
      setLoading(false);
    } catch (error) {
      console.error('Fetch error:', error);
      setLoading(false);
    }
  };

  const filterPokemonData = useCallback(() => {
    let result = [...pokemonList];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(
        (poke) =>
          poke.name.toLowerCase().includes(query) ||
          poke.id.toString() === query
      );
    }

    if (selectedType !== 'all') {
      result = result.filter((poke) =>
        poke.types.some((t) => t.type.name === selectedType)
      );
    }

    if (showFavoritesOnly) {
      result = result.filter((poke) => favorites.includes(poke.id));
    }

    setFilteredList(result);
  }, [pokemonList, searchQuery, selectedType, showFavoritesOnly, favorites]);

  useEffect(() => {
    filterPokemonData();
  }, [filterPokemonData]);

  const calculateTypeEffectiveness = (types) => {
    const attackingTypes = Object.keys(TYPE_CHART);
    const matchups = {
      weak: [],
      resistant: [],
      immune: [],
      normal: [],
    };

    const defenderTypes = types.map((t) => t.type.name);

    attackingTypes.forEach((attackType) => {
      let multiplier = 1.0;
      defenderTypes.forEach((defType) => {
        if (TYPE_CHART[attackType] && TYPE_CHART[attackType][defType] !== undefined) {
          multiplier *= TYPE_CHART[attackType][defType];
        }
      });

      if (multiplier > 1) {
        matchups.weak.push({ type: attackType, multiplier });
      } else if (multiplier === 0) {
        matchups.immune.push({ type: attackType, multiplier });
      } else if (multiplier < 1) {
        matchups.resistant.push({ type: attackType, multiplier });
      } else {
        matchups.normal.push({ type: attackType, multiplier });
      }
    });

    return matchups;
  };

  const speakPokemon = (pokemon) => {
    if (!pokemon) return;

    const name = capitalize(pokemon.name);
    const primaryType = pokemon.types[0]?.type?.name;
    const speechText = `${name}. The ${primaryType} type Pokémon.`;

    setIsSpeaking(true);
    Speech.stop();

    Speech.speak(speechText, {
      language: 'en-US',
      pitch: 1.15,
      rate: 0.95,
      onDone: () => setIsSpeaking(false),
      onError: () => setIsSpeaking(false),
    });
  };

  const openPokemonDetail = (pokemon) => {
    setSelectedPokemon(pokemon);
    setActiveModalTab('about');
    setModalVisible(true);
  };

  const closeModal = () => {
    Speech.stop();
    setIsSpeaking(false);
    setModalVisible(false);
    setSelectedPokemon(null);
  };

  const renderPokemonCard = ({ item }) => {
    const mainType = item.types[0]?.type?.name;
    const themeColor = getTypeColor(mainType);
    const isFav = favorites.includes(item.id);
    const artworkUrl =
      item.sprites?.other?.['official-artwork']?.front_default ||
      item.sprites?.front_default;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, { borderColor: themeColor }]}
        onPress={() => openPokemonDetail(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.pokeId}>#{String(item.id).padStart(4, '0')}</Text>
          <TouchableOpacity
            onPress={() => toggleFavorite(item.id)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.cardFavIcon}>{isFav ? '❤️' : '🤍'}</Text>
          </TouchableOpacity>
        </View>

        <Image source={{ uri: artworkUrl }} style={styles.sprite} />
        <Text style={styles.pokeName}>{capitalize(item.name)}</Text>

        <View style={styles.typesRow}>
          {item.types.map((t) => (
            <Text
              key={t.type.name}
              style={[
                styles.typeBadge,
                { backgroundColor: getTypeColor(t.type.name) },
              ]}
            >
              {t.type.name.toUpperCase()}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" />

      <View style={styles.topHeader}>
        <Text style={styles.appTitle}>Pokédex</Text>
        <TouchableOpacity
          style={[
            styles.favHeaderBtn,
            showFavoritesOnly && styles.favHeaderBtnActive,
          ]}
          onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
        >
          <Text style={styles.favHeaderBtnText}>
            ❤️ {favorites.length}
          </Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search by name or number..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
      />

      <View style={styles.scrollSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.genScrollContent}
        >
          {GENERATIONS.map((gen) => {
            const isSelected = selectedGen === gen.id;
            return (
              <TouchableOpacity
                key={gen.id}
                style={[styles.genPill, isSelected && styles.genPillActive]}
                onPress={() => setSelectedGen(gen.id)}
              >
                <Text
                  style={[
                    styles.genPillText,
                    isSelected && styles.genPillTextActive,
                  ]}
                >
                  {gen.name} ({gen.region})
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.scrollSection}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.typeScrollContent}
        >
          {POKEMON_TYPES.map((type) => {
            const isSelected = selectedType === type;
            const bg = type === 'all' ? '#334155' : getTypeColor(type);
            return (
              <TouchableOpacity
                key={type}
                style={[
                  styles.typePill,
                  { backgroundColor: bg },
                  isSelected && styles.typePillActive,
                ]}
                onPress={() => setSelectedType(type)}
              >
                <Text style={styles.typePillText}>{type.toUpperCase()}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#E3350D" />
          <Text style={styles.loadingText}>
            Exploring {GENERATIONS.find((g) => g.id === selectedGen)?.region}...
          </Text>
        </View>
      ) : filteredList.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No Pokémon Found</Text>
          <Text style={styles.emptySubtitle}>
            Try changing your generation, type filter, or search query.
          </Text>
        </View>
      ) : (
        <FlatList
          data={filteredList}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderPokemonCard}
          numColumns={2}
          columnWrapperStyle={styles.gridRow}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={closeModal}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPokemon && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalControlBar}>
                  <TouchableOpacity
                    onPress={() => toggleFavorite(selectedPokemon.id)}
                    style={styles.modalFavBtn}
                  >
                    <Text style={styles.modalFavBtnText}>
                      {favorites.includes(selectedPokemon.id)
                        ? '❤️ In Favorites'
                        : '🤍 Add Favorite'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalHero}>
                  <Text style={styles.modalId}>
                    #{String(selectedPokemon.id).padStart(4, '0')}
                  </Text>
                  <Text style={styles.modalTitle}>
                    {capitalize(selectedPokemon.name)}
                  </Text>

                  <View style={styles.modalTypesRow}>
                    {selectedPokemon.types.map((t) => (
                      <Text
                        key={t.type.name}
                        style={[
                          styles.modalTypeBadge,
                          { backgroundColor: getTypeColor(t.type.name) },
                        ]}
                      >
                        {t.type.name.toUpperCase()}
                      </Text>
                    ))}
                  </View>
                </View>

                <Image
                  source={{
                    uri:
                      selectedPokemon.sprites?.other?.['official-artwork']
                        ?.front_default ||
                      selectedPokemon.sprites?.front_default,
                  }}
                  style={styles.modalSprite}
                />

                <TouchableOpacity
                  style={[
                    styles.voiceButton,
                    {
                      backgroundColor: getTypeColor(
                        selectedPokemon.types[0]?.type?.name
                      ),
                    },
                  ]}
                  onPress={() => speakPokemon(selectedPokemon)}
                >
                  <Text style={styles.voiceButtonText}>
                    {isSpeaking ? '🗣️ Speaking...' : `🗣️ Say "${capitalize(selectedPokemon.name)}"`}
                  </Text>
                </TouchableOpacity>

                <View style={styles.tabContainer}>
                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      activeModalTab === 'about' && styles.tabBtnActive,
                    ]}
                    onPress={() => setActiveModalTab('about')}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        activeModalTab === 'about' && styles.tabBtnTextActive,
                      ]}
                    >
                      Stats & Info
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      activeModalTab === 'effectiveness' && styles.tabBtnActive,
                    ]}
                    onPress={() => setActiveModalTab('effectiveness')}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        activeModalTab === 'effectiveness' &&
                          styles.tabBtnTextActive,
                      ]}
                    >
                      Matchups
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.tabBtn,
                      activeModalTab === 'moves' && styles.tabBtnActive,
                    ]}
                    onPress={() => setActiveModalTab('moves')}
                  >
                    <Text
                      style={[
                        styles.tabBtnText,
                        activeModalTab === 'moves' && styles.tabBtnTextActive,
                      ]}
                    >
                      Moves ({selectedPokemon.moves.length})
                    </Text>
                  </TouchableOpacity>
                </View>

                {activeModalTab === 'about' && (
                  <View>
                    <View style={styles.dimensionsCard}>
                      <View style={styles.dimensionItem}>
                        <Text style={styles.dimensionLabel}>Weight</Text>
                        <Text style={styles.dimensionValue}>
                          {(selectedPokemon.weight / 10).toFixed(1)} kg
                        </Text>
                      </View>
                      <View style={styles.dimensionDivider} />
                      <View style={styles.dimensionItem}>
                        <Text style={styles.dimensionLabel}>Height</Text>
                        <Text style={styles.dimensionValue}>
                          {(selectedPokemon.height / 10).toFixed(1)} m
                        </Text>
                      </View>
                      <View style={styles.dimensionDivider} />
                      <View style={styles.dimensionItem}>
                        <Text style={styles.dimensionLabel}>Base EXP</Text>
                        <Text style={styles.dimensionValue}>
                          {selectedPokemon.base_experience || 'N/A'}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.sectionHeader}>Abilities</Text>
                    <View style={styles.abilitiesContainer}>
                      {selectedPokemon.abilities.map((item) => (
                        <View key={item.ability.name} style={styles.abilityBadge}>
                          <Text style={styles.abilityText}>
                            {capitalize(item.ability.name)}
                          </Text>
                          {item.is_hidden && (
                            <Text style={styles.hiddenTag}>(Hidden)</Text>
                          )}
                        </View>
                      ))}
                    </View>

                    <Text style={styles.sectionHeader}>Base Stats</Text>
                    <View style={styles.statsContainer}>
                      {selectedPokemon.stats.map((s) => {
                        const percentage = Math.min(
                          (s.base_stat / 255) * 100,
                          100
                        );
                        const barColor = getTypeColor(
                          selectedPokemon.types[0]?.type?.name
                        );
                        return (
                          <View key={s.stat.name} style={styles.statRow}>
                            <Text style={styles.statNameLabel}>
                              {formatStatName(s.stat.name)}
                            </Text>
                            <Text style={styles.statValueLabel}>
                              {s.base_stat}
                            </Text>
                            <View style={styles.statBarBackground}>
                              <View
                                style={[
                                  styles.statBarFill,
                                  {
                                    width: `${percentage}%`,
                                    backgroundColor: barColor,
                                  },
                                ]}
                              />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {activeModalTab === 'effectiveness' && (
                  <View>
                    {(() => {
                      const matchups = calculateTypeEffectiveness(
                        selectedPokemon.types
                      );
                      return (
                        <View>
                          <Text style={styles.sectionHeader}>
                            ⚠️ Weak Against (Takes 2x - 4x Damage)
                          </Text>
                          {matchups.weak.length === 0 ? (
                            <Text style={styles.neutralText}>None</Text>
                          ) : (
                            <View style={styles.typeGrid}>
                              {matchups.weak.map((m) => (
                                <View
                                  key={m.type}
                                  style={[
                                    styles.matchupBadge,
                                    { backgroundColor: getTypeColor(m.type) },
                                  ]}
                                >
                                  <Text style={styles.matchupBadgeText}>
                                    {m.type.toUpperCase()}
                                  </Text>
                                  <Text style={styles.multiplierTag}>
                                    {m.multiplier}x
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          <Text style={[styles.sectionHeader, { marginTop: 14 }]}>
                            🛡️ Resistant To (Takes 0.5x - 0.25x Damage)
                          </Text>
                          {matchups.resistant.length === 0 ? (
                            <Text style={styles.neutralText}>None</Text>
                          ) : (
                            <View style={styles.typeGrid}>
                              {matchups.resistant.map((m) => (
                                <View
                                  key={m.type}
                                  style={[
                                    styles.matchupBadge,
                                    { backgroundColor: getTypeColor(m.type) },
                                  ]}
                                >
                                  <Text style={styles.matchupBadgeText}>
                                    {m.type.toUpperCase()}
                                  </Text>
                                  <Text style={styles.multiplierTag}>
                                    {m.multiplier}x
                                  </Text>
                                </View>
                              ))}
                            </View>
                          )}

                          <Text style={[styles.sectionHeader, { marginTop: 14 }]}>
                            ⛔ Immune To (Takes 0x Damage)
                          </Text>
                          {matchups.immune.length === 0 ? (
                            <Text style={styles.neutralText}>None</Text>
                          ) : (
                            <View style={styles.typeGrid}>
                              {matchups.immune.map((m) => (
                                <View
                                  key={m.type}
                                  style={[
                                    styles.matchupBadge,
                                    { backgroundColor: getTypeColor(m.type) },
                                  ]}
                                >
                                  <Text style={styles.matchupBadgeText}>
                                    {m.type.toUpperCase()}
                                  </Text>
                                  <Text style={styles.multiplierTag}>0x</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      );
                    })()}
                  </View>
                )}

                {activeModalTab === 'moves' && (
                  <View>
                    <Text style={styles.sectionHeader}>
                      Complete Learned Moveset
                    </Text>
                    <View style={styles.movesContainer}>
                      {selectedPokemon.moves.map((m) => {
                        const learnDetail =
                          m.version_group_details[0]?.move_learn_method?.name ||
                          'level-up';
                        const level =
                          m.version_group_details[0]?.level_learned_at;

                        return (
                          <View key={m.move.name} style={styles.moveRow}>
                            <View>
                              <Text style={styles.moveName}>
                                {capitalize(m.move.name)}
                              </Text>
                              <Text style={styles.moveLearnMethod}>
                                {learnDetail === 'level-up'
                                  ? `Level ${level}`
                                  : capitalize(learnDetail)}
                              </Text>
                            </View>
                            <Text style={styles.moveLearnTag}>
                              {learnDetail.toUpperCase()}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    marginBottom: 8,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#0F172A',
  },
  favHeaderBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  favHeaderBtnActive: {
    backgroundColor: '#FEE2E2',
    borderColor: '#FCA5A5',
  },
  favHeaderBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#E11D48',
  },
  searchBar: {
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginBottom: 8,
  },
  scrollSection: {
    marginBottom: 8,
  },
  genScrollContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  genPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: '#E2E8F0',
  },
  genPillActive: {
    backgroundColor: '#0284C7',
  },
  genPillText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  genPillTextActive: {
    color: '#FFF',
  },
  typeScrollContent: {
    paddingHorizontal: 16,
    gap: 6,
  },
  typePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    opacity: 0.75,
  },
  typePillActive: {
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
  typePillText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  listContent: {
    paddingHorizontal: 10,
    paddingBottom: 24,
  },
  gridRow: {
    justifyContent: 'space-between',
  },
  card: {
    flex: 1,
    backgroundColor: '#FFF',
    margin: 6,
    padding: 12,
    borderRadius: 16,
    alignItems: 'center',
    borderWidth: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    alignItems: 'center',
  },
  pokeId: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#94A3B8',
  },
  cardFavIcon: {
    fontSize: 14,
  },
  sprite: {
    width: 90,
    height: 90,
    marginVertical: 4,
  },
  pokeName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1E293B',
  },
  typesRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  typeBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFF',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  loadingText: {
    marginTop: 10,
    color: '#64748B',
    fontSize: 14,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#334155',
  },
  emptySubtitle: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 36,
    maxHeight: '90%',
  },
  modalControlBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalFavBtn: {
    backgroundColor: '#F8FAFC',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  modalFavBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  closeBtn: {
    backgroundColor: '#F1F5F9',
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#64748B',
  },
  modalHero: {
    alignItems: 'center',
    marginTop: 4,
  },
  modalId: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94A3B8',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    marginTop: 2,
  },
  modalTypesRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  modalTypeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FFF',
  },
  modalSprite: {
    width: 170,
    height: 170,
    alignSelf: 'center',
    marginVertical: 6,
  },
  voiceButton: {
    alignSelf: 'center',
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 22,
    marginBottom: 14,
    elevation: 2,
  },
  voiceButtonText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: 'bold',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F1F5F9',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabBtnActive: {
    backgroundColor: '#FFF',
    elevation: 1,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  tabBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
  },
  tabBtnTextActive: {
    color: '#0F172A',
  },
  dimensionsCard: {
    flexDirection: 'row',
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    paddingVertical: 12,
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  dimensionItem: {
    alignItems: 'center',
    flex: 1,
  },
  dimensionLabel: {
    fontSize: 11,
    color: '#64748B',
    marginBottom: 2,
    fontWeight: '600',
  },
  dimensionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  dimensionDivider: {
    width: 1,
    height: 24,
    backgroundColor: '#CBD5E1',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
    marginBottom: 8,
  },
  abilitiesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  abilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  abilityText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  hiddenTag: {
    fontSize: 10,
    color: '#E11D48',
    marginLeft: 4,
    fontWeight: 'bold',
  },
  statsContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  statNameLabel: {
    width: 65,
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
  },
  statValueLabel: {
    width: 32,
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1E293B',
    textAlign: 'right',
    marginRight: 10,
  },
  statBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: '#E2E8F0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: 4,
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  matchupBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  matchupBadgeText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  multiplierTag: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    fontSize: 9,
    fontWeight: 'bold',
    color: '#FFF',
  },
  neutralText: {
    fontSize: 12,
    color: '#94A3B8',
    fontStyle: 'italic',
  },
  movesContainer: {
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  moveRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  moveName: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E293B',
  },
  moveLearnMethod: {
    fontSize: 11,
    color: '#64748B',
    marginTop: 2,
  },
  moveLearnTag: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#0284C7',
    backgroundColor: '#E0F2FE',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
});

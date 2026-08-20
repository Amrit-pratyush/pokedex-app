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
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Speech from 'expo-speech';
import { Audio } from 'expo-av';

// --- CONFIGURATION & CONSTANTS ---
const GENERATIONS = [
  { id: 'all', name: 'All Gens', region: 'National', offset: 0, limit: 1025 },
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

const POKEBALL_RATES = {
  Pokéball: 1,
  'Great Ball': 1.5,
  'Ultra Ball': 2,
  'Fast Ball': 4,
};

const STATUS_BONUSES = {
  None: 1,
  Paralyzed: 1.5,
  Poisoned: 1.5,
  Burned: 1.5,
  Asleep: 2.5,
  Frozen: 2.5,
};

const capitalize = (str) => (str ? str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, ' ') : '');
const getTypeColor = (type) => TYPE_COLORS[type?.toLowerCase()] || '#94A3B8';
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
  const [isGlobalShiny, setIsGlobalShiny] = useState(false);
  const [favorites, setFavorites] = useState([]);

  // Multi-Team Management (Up to 20 Teams)
  const [allTeams, setAllTeams] = useState([{ id: 'team-1', name: 'Team 1', members: [] }]);
  const [selectedTeamId, setSelectedTeamId] = useState('team-1');
  const [showTeamModal, setShowTeamModal] = useState(false);

  const [pokemonList, setPokemonList] = useState([]);
  const [filteredList, setFilteredList] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  const [selectedPokemon, setSelectedPokemon] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState('about');
  const [modalShiny, setModalShiny] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPlayingCry, setIsPlayingCry] = useState(false);

  const [abilityDetails, setAbilityDetails] = useState({});
  const [allVarieties, setAllVarieties] = useState([]);
  const [evolutionChain, setEvolutionChain] = useState([]);
  const [speciesDataState, setSpeciesDataState] = useState(null);
  const [loadingModalData, setLoadingModalData] = useState(false);

  // Calculator State
  const [calcLevel, setCalcLevel] = useState(50);
  const [calcNature, setCalcNature] = useState('neutral');
  const [calcHpPercent, setCalcHpPercent] = useState(100);
  const [selectedBall, setSelectedBall] = useState('Pokéball');
  const [selectedStatus, setSelectedStatus] = useState('None');

  useEffect(() => {
    loadStorageData();
  }, []);

  useEffect(() => {
    fetchGenerationPokemon(selectedGen);
  }, [selectedGen]);

  const loadStorageData = async () => {
    try {
      const storedFavs = await AsyncStorage.getItem('@pokedex_favs');
      if (storedFavs) setFavorites(JSON.parse(storedFavs));

      const storedTeams = await AsyncStorage.getItem('@pokedex_multi_teams');
      if (storedTeams) {
        const parsed = JSON.parse(storedTeams);
        if (parsed.length > 0) {
          setAllTeams(parsed);
          setSelectedTeamId(parsed[0].id);
        }
      }
    } catch (e) {
      console.log('Error loading storage data:', e);
    }
  };

  const saveTeamsToStorage = async (teams) => {
    setAllTeams(teams);
    await AsyncStorage.setItem('@pokedex_multi_teams', JSON.stringify(teams));
  };

  const createNewTeam = () => {
    if (allTeams.length >= 20) {
      Alert.alert('Limit Reached', 'You have reached the maximum limit of 20 teams.');
      return;
    }
    const newId = `team-${Date.now()}`;
    const newName = `Team ${allTeams.length + 1}`;
    const updated = [...allTeams, { id: newId, name: newName, members: [] }];
    saveTeamsToStorage(updated);
    setSelectedTeamId(newId);
  };

  const deleteTeam = (teamId) => {
    if (allTeams.length <= 1) {
      Alert.alert('Cannot Delete', 'You must maintain at least one active team.');
      return;
    }
    const updated = allTeams.filter((t) => t.id !== teamId);
    saveTeamsToStorage(updated);
    if (selectedTeamId === teamId) {
      setSelectedTeamId(updated[0].id);
    }
  };

  const currentActiveTeam = allTeams.find((t) => t.id === selectedTeamId) || allTeams[0];

  const toggleTeamMember = (pokemon) => {
    const activeTeam = currentActiveTeam;
    const exists = activeTeam.members.some((m) => m.id === pokemon.id);
    let newMembers;

    if (exists) {
      newMembers = activeTeam.members.filter((m) => m.id !== pokemon.id);
    } else {
      if (activeTeam.members.length >= 6) {
        Alert.alert('Team Full', `"${activeTeam.name}" already has 6 Pokémon.`);
        return;
      }
      newMembers = [
        ...activeTeam.members,
        {
          id: pokemon.id,
          name: pokemon.name,
          types: pokemon.types,
          sprite: pokemon.sprites?.other?.['official-artwork']?.front_default || pokemon.sprites?.front_default,
        },
      ];
    }

    const updatedTeams = allTeams.map((t) =>
      t.id === activeTeam.id ? { ...t, members: newMembers } : t
    );
    saveTeamsToStorage(updatedTeams);
  };

  const toggleFavorite = async (pokemonId) => {
    try {
      const updated = favorites.includes(pokemonId)
        ? favorites.filter((id) => id !== pokemonId)
        : [...favorites, pokemonId];
      setFavorites(updated);
      await AsyncStorage.setItem('@pokedex_favs', JSON.stringify(updated));
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

  // Parse Evolution Chain with detailed Trigger Explanations
  const getEvolutionTriggerText = (details) => {
    if (!details || details.length === 0) return 'Base Form';
    const d = details[0];
    const trigger = d.trigger?.name;

    if (trigger === 'level-up') {
      if (d.min_level) return `Level ${d.min_level}`;
      if (d.min_happiness) return `High Friendship (${d.min_happiness})`;
      if (d.time_of_day) return `Level up (${capitalize(d.time_of_day)})`;
      if (d.known_move) return `Learn ${capitalize(d.known_move.name)}`;
      if (d.held_item) return `Hold ${capitalize(d.held_item.name)}`;
      if (d.location) return `At ${capitalize(d.location.name)}`;
      return 'Level Up';
    }
    if (trigger === 'use-item') {
      return `Use ${capitalize(d.item?.name || 'Item')}`;
    }
    if (trigger === 'trade') {
      if (d.held_item) return `Trade holding ${capitalize(d.held_item.name)}`;
      return 'Trade';
    }
    return capitalize(trigger);
  };

  const parseEvolutionNode = (node, chain = [], incomingTrigger = 'Base Form') => {
    if (!node) return chain;
    const urlParts = node.species.url.split('/').filter(Boolean);
    const speciesId = urlParts[urlParts.length - 1];

    chain.push({
      id: speciesId,
      name: node.species.name,
      triggerDescription: incomingTrigger,
      imageUrl: `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${speciesId}.png`,
    });

    if (node.evolves_to && node.evolves_to.length > 0) {
      node.evolves_to.forEach((nextStage) => {
        const nextTrigger = getEvolutionTriggerText(nextStage.evolution_details);
        parseEvolutionNode(nextStage, chain, nextTrigger);
      });
    }
    return chain;
  };

  const calculateTypeEffectiveness = (types) => {
    const attackingTypes = Object.keys(TYPE_CHART);
    const matchups = { weak: [], resistant: [], immune: [] };
    const defenderTypes = types.map((t) => t.type.name);

    attackingTypes.forEach((attackType) => {
      let multiplier = 1.0;
      defenderTypes.forEach((defType) => {
        if (TYPE_CHART[attackType] && TYPE_CHART[attackType][defType] !== undefined) {
          multiplier *= TYPE_CHART[attackType][defType];
        }
      });

      if (multiplier > 1) matchups.weak.push({ type: attackType, multiplier });
      else if (multiplier === 0) matchups.immune.push({ type: attackType, multiplier });
      else if (multiplier < 1) matchups.resistant.push({ type: attackType, multiplier });
    });

    return matchups;
  };

  const playPokemonCry = async (pokemon) => {
    const cryUrl = pokemon.cries?.latest || `https://play.pokemonshowdown.com/audio/cries/${pokemon.name.toLowerCase().replace(/-/g, '')}.mp3`;
    try {
      setIsPlayingCry(true);
      const { sound } = await Audio.Sound.createAsync({ uri: cryUrl });
      await sound.playAsync();
      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.didJustFinish) {
          setIsPlayingCry(false);
          sound.unloadAsync();
        }
      });
    } catch {
      setIsPlayingCry(false);
    }
  };

  const speakPokemon = (pokemon) => {
    if (!pokemon) return;
    const name = capitalize(pokemon.name);
    const typesList = pokemon.types.map((t) => t.type.name).join(' and ');
    const speechText = `${name}. The ${typesList} type Pokémon.`;

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

  const openPokemonDetail = async (pokemon) => {
    setSelectedPokemon(pokemon);
    setActiveModalTab('about');
    setModalShiny(isGlobalShiny);
    setModalVisible(true);
    setLoadingModalData(true);
    setAbilityDetails({});
    setAllVarieties([]);
    setEvolutionChain([]);
    setSpeciesDataState(null);

    try {
      const abilityPromises = pokemon.abilities.map(async (ab) => {
        try {
          const res = await fetch(ab.ability.url);
          const data = await res.json();
          const effectEntry =
            data.effect_entries.find((e) => e.language.name === 'en')?.short_effect ||
            data.flavor_text_entries.find((f) => f.language.name === 'en')?.flavor_text ||
            'Passive battle ability.';
          return { name: ab.ability.name, effect: effectEntry };
        } catch {
          return { name: ab.ability.name, effect: 'Passive battle effect.' };
        }
      });

      const abilityResults = await Promise.all(abilityPromises);
      const abilityMap = {};
      abilityResults.forEach((item) => {
        abilityMap[item.name] = item.effect;
      });
      setAbilityDetails(abilityMap);

      const speciesRes = await fetch(pokemon.species.url);
      const speciesData = await speciesRes.json();
      setSpeciesDataState(speciesData);

      const alternateEntries = speciesData.varieties.filter(
        (v) => !v.is_default && v.pokemon.name !== pokemon.name
      );

      if (alternateEntries.length > 0) {
        const forms = await Promise.all(
          alternateEntries.map(async (f) => {
            const fRes = await fetch(f.pokemon.url);
            return await fRes.json();
          })
        );
        setAllVarieties(forms);
      }

      if (speciesData.evolution_chain?.url) {
        const evoRes = await fetch(speciesData.evolution_chain.url);
        const evoData = await evoRes.json();
        const chain = parseEvolutionNode(evoData.chain);
        setEvolutionChain(chain);
      }
    } catch (err) {
      console.log('Error modal:', err);
    } finally {
      setLoadingModalData(false);
    }
  };

  const closeModal = () => {
    Speech.stop();
    setIsSpeaking(false);
    setModalVisible(false);
    setSelectedPokemon(null);
  };

  const calculateCaptureRate = () => {
    if (!speciesDataState || !selectedPokemon) return 0;
    const baseCaptureRate = speciesDataState.capture_rate || 45;
    const ballMultiplier = POKEBALL_RATES[selectedBall] || 1;
    const statusMultiplier = STATUS_BONUSES[selectedStatus] || 1;
    const hpFactor = (3 * 100 - 2 * calcHpPercent) / (3 * 100);
    const a = Math.min(255, Math.floor(baseCaptureRate * ballMultiplier * hpFactor * statusMultiplier));
    return Math.min(100, Math.max(1, Math.round((a / 255) * 100)));
  };

  const calculateActualStat = (statName, baseStat) => {
    const iv = 31;
    const ev = 85;
    if (statName === 'hp') {
      if (baseStat === 1) return 1;
      return Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * calcLevel) / 100) + calcLevel + 10;
    }
    const rawStat = Math.floor(((2 * baseStat + iv + Math.floor(ev / 4)) * calcLevel) / 100) + 5;
    let natureMult = 1.0;
    if (calcNature === 'beneficial') natureMult = 1.1;
    if (calcNature === 'hindering') natureMult = 0.9;
    return Math.floor(rawStat * natureMult);
  };

  const renderPokemonCard = ({ item }) => {
    const mainType = item.types[0]?.type?.name;
    const themeColor = getTypeColor(mainType);
    const isFav = favorites.includes(item.id);
    const isInTeam = currentActiveTeam.members.some((t) => t.id === item.id);
    const artworkUrl = isGlobalShiny
      ? (item.sprites?.other?.['official-artwork']?.front_shiny || item.sprites?.front_shiny)
      : (item.sprites?.other?.['official-artwork']?.front_default || item.sprites?.front_default);

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.card, { borderColor: themeColor }]}
        onPress={() => openPokemonDetail(item)}
      >
        <View style={styles.cardHeader}>
          <Text style={styles.pokeId}>#{String(item.id).padStart(4, '0')}</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <TouchableOpacity onPress={() => toggleTeamMember(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={{ fontSize: 13 }}>{isInTeam ? '⚔️' : '➕'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => toggleFavorite(item.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.cardFavIcon}>{isFav ? '❤️' : '🤍'}</Text>
            </TouchableOpacity>
          </View>
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
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <TouchableOpacity
            style={[styles.favHeaderBtn, styles.teamActiveBtn]}
            onPress={() => setShowTeamModal(true)}
          >
            <Text style={styles.favHeaderBtnText}>⚔️ Teams ({allTeams.length}/20)</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.favHeaderBtn, isGlobalShiny && styles.shinyActiveBtn]}
            onPress={() => setIsGlobalShiny(!isGlobalShiny)}
          >
            <Text style={styles.favHeaderBtnText}>✨ Shiny</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.favHeaderBtn, showFavoritesOnly && styles.favHeaderBtnActive]}
            onPress={() => setShowFavoritesOnly(!showFavoritesOnly)}
          >
            <Text style={styles.favHeaderBtnText}>❤️ {favorites.length}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <TextInput
        style={styles.searchBar}
        placeholder="Search by name or number..."
        value={searchQuery}
        onChangeText={setSearchQuery}
        clearButtonMode="while-editing"
      />

      <View style={styles.scrollSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.genScrollContent}>
          {GENERATIONS.map((gen) => {
            const isSelected = selectedGen === gen.id;
            return (
              <TouchableOpacity
                key={gen.id}
                style={[styles.genPill, isSelected && styles.genPillActive]}
                onPress={() => setSelectedGen(gen.id)}
              >
                <Text style={[styles.genPillText, isSelected && styles.genPillTextActive]}>
                  {gen.name}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <View style={styles.scrollSection}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.typeScrollContent}>
          {POKEMON_TYPES.map((type) => {
            const isSelected = selectedType === type;
            const bg = type === 'all' ? '#334155' : getTypeColor(type);
            return (
              <TouchableOpacity
                key={type}
                style={[styles.typePill, { backgroundColor: bg }, isSelected && styles.typePillActive]}
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
          <Text style={styles.loadingText}>Exploring {GENERATIONS.find((g) => g.id === selectedGen)?.region}...</Text>
        </View>
      ) : filteredList.length === 0 ? (
        <View style={styles.centerContainer}>
          <Text style={styles.emptyTitle}>No Pokémon Found</Text>
          <Text style={styles.emptySubtitle}>Try changing your generation or filter.</Text>
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

      {/* --- DETAIL MODAL --- */}
      <Modal animationType="slide" transparent={true} visible={modalVisible} onRequestClose={closeModal}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selectedPokemon && (
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalControlBar}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity onPress={() => toggleFavorite(selectedPokemon.id)} style={styles.modalFavBtn}>
                      <Text style={styles.modalFavBtnText}>
                        {favorites.includes(selectedPokemon.id) ? '❤️ Saved' : '🤍 Save'}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity onPress={() => toggleTeamMember(selectedPokemon)} style={styles.modalFavBtn}>
                      <Text style={styles.modalFavBtnText}>
                        {currentActiveTeam.members.some((t) => t.id === selectedPokemon.id)
                          ? `⚔️ In ${currentActiveTeam.name}`
                          : `➕ Add to ${currentActiveTeam.name}`}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      onPress={() => setModalShiny(!modalShiny)}
                      style={[styles.modalFavBtn, modalShiny && styles.shinyActiveBtn]}
                    >
                      <Text style={styles.modalFavBtnText}>✨ Shiny</Text>
                    </TouchableOpacity>
                  </View>

                  <TouchableOpacity style={styles.closeBtn} onPress={closeModal}>
                    <Text style={styles.closeBtnText}>✕</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.modalHero}>
                  <Text style={styles.modalId}>#{String(selectedPokemon.id).padStart(4, '0')}</Text>
                  <Text style={styles.modalTitle}>{capitalize(selectedPokemon.name)}</Text>

                  <View style={styles.modalTypesRow}>
                    {selectedPokemon.types.map((t) => (
                      <Text
                        key={t.type.name}
                        style={[styles.modalTypeBadge, { backgroundColor: getTypeColor(t.type.name) }]}
                      >
                        {t.type.name.toUpperCase()}
                      </Text>
                    ))}
                  </View>
                </View>

                <Image
                  source={{
                    uri: modalShiny
                      ? (selectedPokemon.sprites?.other?.showdown?.front_shiny ||
                         selectedPokemon.sprites?.other?.['official-artwork']?.front_shiny ||
                         selectedPokemon.sprites?.front_shiny)
                      : (selectedPokemon.sprites?.other?.showdown?.front_default ||
                         selectedPokemon.sprites?.other?.['official-artwork']?.front_default ||
                         selectedPokemon.sprites?.front_default),
                  }}
                  style={styles.modalSprite}
                />

                <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 10, marginBottom: 14 }}>
                  <TouchableOpacity
                    style={[styles.voiceButton, { backgroundColor: getTypeColor(selectedPokemon.types[0]?.type?.name) }]}
                    onPress={() => playPokemonCry(selectedPokemon)}
                  >
                    <Text style={styles.voiceButtonText}>{isPlayingCry ? '🔊 Playing Cry...' : '🔊 Play Cry'}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[styles.voiceButton, { backgroundColor: '#334155' }]}
                    onPress={() => speakPokemon(selectedPokemon)}
                  >
                    <Text style={styles.voiceButtonText}>{isSpeaking ? '🗣️ Speaking...' : '🗣️ Say Name'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.tabContainer}>
                  {['about', 'evolutions', 'forms', 'calc', 'matchups', 'moves'].map((tab) => (
                    <TouchableOpacity
                      key={tab}
                      style={[styles.tabBtn, activeModalTab === tab && styles.tabBtnActive]}
                      onPress={() => setActiveModalTab(tab)}
                    >
                      <Text style={[styles.tabBtnText, activeModalTab === tab && styles.tabBtnTextActive]}>
                        {capitalize(tab)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {activeModalTab === 'about' && (
                  <View>
                    <View style={styles.dimensionsCard}>
                      <View style={styles.dimensionItem}>
                        <Text style={styles.dimensionLabel}>Weight</Text>
                        <Text style={styles.dimensionValue}>{(selectedPokemon.weight / 10).toFixed(1)} kg</Text>
                      </View>
                      <View style={styles.dimensionDivider} />
                      <View style={styles.dimensionItem}>
                        <Text style={styles.dimensionLabel}>Height</Text>
                        <Text style={styles.dimensionValue}>{(selectedPokemon.height / 10).toFixed(1)} m</Text>
                      </View>
                      <View style={styles.dimensionDivider} />
                      <View style={styles.dimensionItem}>
                        <Text style={styles.dimensionLabel}>Base EXP</Text>
                        <Text style={styles.dimensionValue}>{selectedPokemon.base_experience || 'N/A'}</Text>
                      </View>
                    </View>

                    <Text style={styles.sectionHeader}>Abilities & Effects</Text>
                    <View style={styles.abilitiesList}>
                      {selectedPokemon.abilities.map((item) => (
                        <View key={item.ability.name} style={styles.abilityCard}>
                          <View style={styles.abilityHeaderRow}>
                            <Text style={styles.abilityTitle}>{capitalize(item.ability.name)}</Text>
                            {item.is_hidden && <Text style={styles.hiddenTagBadge}>Hidden</Text>}
                          </View>
                          <Text style={styles.abilityDescText}>
                            {abilityDetails[item.ability.name] || (loadingModalData ? 'Loading...' : 'Passive battle effect.')}
                          </Text>
                        </View>
                      ))}
                    </View>

                    <Text style={styles.sectionHeader}>Base Stats</Text>
                    <View style={styles.statsContainer}>
                      {selectedPokemon.stats.map((s) => {
                        const percentage = Math.min((s.base_stat / 255) * 100, 100);
                        const barColor = getTypeColor(selectedPokemon.types[0]?.type?.name);
                        return (
                          <View key={s.stat.name} style={styles.statRow}>
                            <Text style={styles.statNameLabel}>{formatStatName(s.stat.name)}</Text>
                            <Text style={styles.statValueLabel}>{s.base_stat}</Text>
                            <View style={styles.statBarBackground}>
                              <View style={[styles.statBarFill, { width: `${percentage}%`, backgroundColor: barColor }]} />
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}

                {activeModalTab === 'evolutions' && (
                  <View>
                    <Text style={styles.sectionHeader}>Evolutionary Path & Conditions</Text>
                    {evolutionChain.length === 0 ? (
                      <Text style={styles.neutralText}>No evolution data found.</Text>
                    ) : (
                      <View style={styles.evoChainWrapper}>
                        {evolutionChain.map((stage, idx) => (
                          <View key={`${stage.id}-${idx}`} style={styles.evoDetailItem}>
                            {idx > 0 && (
                              <View style={styles.evoRequirementBox}>
                                <Text style={styles.evoArrowText}>➔</Text>
                                <Text style={styles.evoRequirementBadge}>{stage.triggerDescription}</Text>
                              </View>
                            )}
                            <View style={styles.evoNodeCard}>
                              <Image source={{ uri: stage.imageUrl }} style={styles.evoSpriteLarge} />
                              <Text style={styles.evoNodeName}>{capitalize(stage.name)}</Text>
                              <Text style={styles.evoNodeId}>#{String(stage.id).padStart(4, '0')}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                )}

                {activeModalTab === 'forms' && (
                  <View>
                    {allVarieties.length === 0 ? (
                      <View style={styles.noMegaBox}>
                        <Text style={styles.noMegaTitle}>Standard Form Only</Text>
                        <Text style={styles.noMegaDesc}>{capitalize(selectedPokemon.name)} has no alternate regional or mega forms.</Text>
                      </View>
                    ) : (
                      allVarieties.map((form) => {
                        const formArt = form.sprites?.other?.['official-artwork']?.front_default || form.sprites?.front_default;
                        return (
                          <View key={form.name} style={styles.megaCard}>
                            <Text style={styles.megaFormTitle}>{capitalize(form.name)}</Text>
                            <View style={styles.modalTypesRow}>
                              {form.types.map((t) => (
                                <Text key={t.type.name} style={[styles.modalTypeBadge, { backgroundColor: getTypeColor(t.type.name) }]}>
                                  {t.type.name.toUpperCase()}
                                </Text>
                              ))}
                            </View>
                            {formArt && <Image source={{ uri: formArt }} style={styles.megaSprite} />}
                            <Text style={[styles.sectionHeader, { marginTop: 10 }]}>Stat Comparison vs Base</Text>
                            <View style={styles.statsContainer}>
                              {form.stats.map((fStat, idx) => {
                                const baseStatVal = selectedPokemon.stats[idx]?.base_stat || 0;
                                const diff = fStat.base_stat - baseStatVal;
                                const diffColor = diff > 0 ? '#16A34A' : diff < 0 ? '#DC2626' : '#64748B';
                                return (
                                  <View key={fStat.stat.name} style={styles.statRow}>
                                    <Text style={styles.statNameLabel}>{formatStatName(fStat.stat.name)}</Text>
                                    <Text style={styles.statValueLabel}>{fStat.base_stat}</Text>
                                    <Text style={[styles.diffLabel, { color: diffColor }]}>
                                      {diff > 0 ? `+${diff}` : diff === 0 ? '0' : `${diff}`}
                                    </Text>
                                  </View>
                                );
                              })}
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {activeModalTab === 'calc' && (
                  <View>
                    <Text style={styles.sectionHeader}>🎯 Catch Probability Calculator</Text>
                    <View style={styles.calcCard}>
                      <Text style={styles.calcTitle}>Calculated Catch Rate: <Text style={{ color: '#E11D48', fontWeight: '900' }}>{calculateCaptureRate()}%</Text></Text>
                      <Text style={styles.dimensionLabel}>Target HP Percentage: {calcHpPercent}%</Text>
                      <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6 }}>
                        {[100, 50, 20, 1].map((hp) => (
                          <TouchableOpacity
                            key={hp}
                            style={[styles.smallPill, calcHpPercent === hp && styles.smallPillActive]}
                            onPress={() => setCalcHpPercent(hp)}
                          >
                            <Text style={[styles.smallPillText, calcHpPercent === hp && styles.smallPillTextActive]}>{hp}% HP</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={[styles.dimensionLabel, { marginTop: 8 }]}>Select Pokéball:</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                        {Object.keys(POKEBALL_RATES).map((ball) => (
                          <TouchableOpacity
                            key={ball}
                            style={[styles.smallPill, selectedBall === ball && styles.smallPillActive]}
                            onPress={() => setSelectedBall(ball)}
                          >
                            <Text style={[styles.smallPillText, selectedBall === ball && styles.smallPillTextActive]}>{ball}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>

                      <Text style={[styles.dimensionLabel, { marginTop: 8 }]}>Status Condition:</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 }}>
                        {Object.keys(STATUS_BONUSES).map((status) => (
                          <TouchableOpacity
                            key={status}
                            style={[styles.smallPill, selectedStatus === status && styles.smallPillActive]}
                            onPress={() => setSelectedStatus(status)}
                          >
                            <Text style={[styles.smallPillText, selectedStatus === status && styles.smallPillTextActive]}>{status}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>

                    <Text style={[styles.sectionHeader, { marginTop: 14 }]}>📊 Battle Stat Calculator</Text>
                    <View style={styles.calcCard}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <Text style={styles.dimensionLabel}>Target Level: {calcLevel}</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {[50, 100].map((lvl) => (
                            <TouchableOpacity
                              key={lvl}
                              style={[styles.smallPill, calcLevel === lvl && styles.smallPillActive]}
                              onPress={() => setCalcLevel(lvl)}
                            >
                              <Text style={[styles.smallPillText, calcLevel === lvl && styles.smallPillTextActive]}>Lvl {lvl}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <Text style={styles.dimensionLabel}>Nature Modifier:</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                          {['hindering', 'neutral', 'beneficial'].map((nat) => (
                            <TouchableOpacity
                              key={nat}
                              style={[styles.smallPill, calcNature === nat && styles.smallPillActive]}
                              onPress={() => setCalcNature(nat)}
                            >
                              <Text style={[styles.smallPillText, calcNature === nat && styles.smallPillTextActive]}>{capitalize(nat)}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>

                      <View style={styles.statsContainer}>
                        {selectedPokemon.stats.map((s) => {
                          const realStat = calculateActualStat(s.stat.name, s.base_stat);
                          return (
                            <View key={s.stat.name} style={styles.statRow}>
                              <Text style={styles.statNameLabel}>{formatStatName(s.stat.name)}</Text>
                              <Text style={styles.statValueLabel}>{realStat}</Text>
                              <Text style={{ fontSize: 10, color: '#94A3B8', marginLeft: 'auto' }}>Base: {s.base_stat}</Text>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  </View>
                )}

                {activeModalTab === 'matchups' && (
                  <View>
                    {(() => {
                      const matchups = calculateTypeEffectiveness(selectedPokemon.types);
                      return (
                        <View>
                          <Text style={styles.sectionHeader}>⚠️ Weak Against (Takes 2x - 4x Damage)</Text>
                          {matchups.weak.length === 0 ? (
                            <Text style={styles.neutralText}>None</Text>
                          ) : (
                            <View style={styles.typeGrid}>
                              {matchups.weak.map((m) => (
                                <View key={m.type} style={[styles.matchupBadge, { backgroundColor: getTypeColor(m.type) }]}>
                                  <Text style={styles.matchupBadgeText}>{m.type.toUpperCase()}</Text>
                                  <Text style={styles.multiplierTag}>{m.multiplier}x</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          <Text style={[styles.sectionHeader, { marginTop: 14 }]}>🛡️ Resistant To (Takes 0.5x - 0.25x Damage)</Text>
                          {matchups.resistant.length === 0 ? (
                            <Text style={styles.neutralText}>None</Text>
                          ) : (
                            <View style={styles.typeGrid}>
                              {matchups.resistant.map((m) => (
                                <View key={m.type} style={[styles.matchupBadge, { backgroundColor: getTypeColor(m.type) }]}>
                                  <Text style={styles.matchupBadgeText}>{m.type.toUpperCase()}</Text>
                                  <Text style={styles.multiplierTag}>{m.multiplier}x</Text>
                                </View>
                              ))}
                            </View>
                          )}

                          <Text style={[styles.sectionHeader, { marginTop: 14 }]}>⛔ Immune To (Takes 0x Damage)</Text>
                          {matchups.immune.length === 0 ? (
                            <Text style={styles.neutralText}>None</Text>
                          ) : (
                            <View style={styles.typeGrid}>
                              {matchups.immune.map((m) => (
                                <View key={m.type} style={[styles.matchupBadge, { backgroundColor: getTypeColor(m.type) }]}>
                                  <Text style={styles.matchupBadgeText}>{m.type.toUpperCase()}</Text>
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
                    <Text style={styles.sectionHeader}>Learned Moveset ({selectedPokemon.moves.length})</Text>
                    <View style={styles.movesContainer}>
                      {selectedPokemon.moves.map((m) => {
                        const learnDetail = m.version_group_details[0]?.move_learn_method?.name || 'level-up';
                        const level = m.version_group_details[0]?.level_learned_at;
                        return (
                          <View key={m.move.name} style={styles.moveRow}>
                            <View>
                              <Text style={styles.moveName}>{capitalize(m.move.name)}</Text>
                              <Text style={styles.moveLearnMethod}>
                                {learnDetail === 'level-up' ? `Level ${level}` : capitalize(learnDetail)}
                              </Text>
                            </View>
                            <Text style={styles.moveLearnTag}>{learnDetail.toUpperCase()}</Text>
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

      {/* --- 20 MULTI-TEAM BUILDER MODAL --- */}
      <Modal animationType="slide" transparent={true} visible={showTeamModal} onRequestClose={() => setShowTeamModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalControlBar}>
              <Text style={styles.modalTitle}>Team Manager ({allTeams.length}/20)</Text>
              <TouchableOpacity style={styles.closeBtn} onPress={() => setShowTeamModal(false)}>
                <Text style={styles.closeBtnText}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Team Switcher Tabs & New Team Button */}
            <View style={{ marginVertical: 8 }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                {allTeams.map((teamItem) => {
                  const isCurrent = teamItem.id === selectedTeamId;
                  return (
                    <TouchableOpacity
                      key={teamItem.id}
                      style={[styles.teamTabPill, isCurrent && styles.teamTabPillActive]}
                      onPress={() => setSelectedTeamId(teamItem.id)}
                    >
                      <Text style={[styles.teamTabPillText, isCurrent && styles.teamTabPillTextActive]}>
                        {teamItem.name} ({teamItem.members.length}/6)
                      </Text>
                    </TouchableOpacity>
                  );
                })}

                {allTeams.length < 20 && (
                  <TouchableOpacity style={styles.newTeamBtn} onPress={createNewTeam}>
                    <Text style={styles.newTeamBtnText}>➕ New Team</Text>
                  </TouchableOpacity>
                )}
              </ScrollView>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 6 }}>
                <Text style={styles.sectionHeader}>{currentActiveTeam.name} Roster</Text>
                {allTeams.length > 1 && (
                  <TouchableOpacity onPress={() => deleteTeam(currentActiveTeam.id)}>
                    <Text style={{ color: '#E11D48', fontWeight: 'bold', fontSize: 12 }}>Delete This Team 🗑️</Text>
                  </TouchableOpacity>
                )}
              </View>

              {currentActiveTeam.members.length === 0 ? (
                <View style={styles.noMegaBox}>
                  <Text style={styles.noMegaTitle}>This Team is Empty</Text>
                  <Text style={styles.noMegaDesc}>Tap ➕ on any Pokémon card or detail screen to add up to 6 members.</Text>
                </View>
              ) : (
                <View>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 }}>
                    {currentActiveTeam.members.map((member) => (
                      <View key={member.id} style={styles.teamMemberCard}>
                        <Image source={{ uri: member.sprite }} style={{ width: 60, height: 60 }} />
                        <Text style={styles.pokeName}>{capitalize(member.name)}</Text>
                        <TouchableOpacity onPress={() => toggleTeamMember(member)}>
                          <Text style={{ color: '#E11D48', fontSize: 11, fontWeight: 'bold', marginTop: 4 }}>Remove ✖</Text>
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>

                  <Text style={[styles.sectionHeader, { marginTop: 12 }]}>{currentActiveTeam.name} Shared Weaknesses</Text>
                  <View style={styles.calcCard}>
                    {(() => {
                      const weaknessCounts = {};
                      currentActiveTeam.members.forEach((member) => {
                        const matchups = calculateTypeEffectiveness(member.types);
                        matchups.weak.forEach((w) => {
                          weaknessCounts[w.type] = (weaknessCounts[w.type] || 0) + 1;
                        });
                      });

                      const sortedWeaknesses = Object.entries(weaknessCounts).sort((a, b) => b[1] - a[1]);

                      if (sortedWeaknesses.length === 0) {
                        return <Text style={styles.neutralText}>No critical weaknesses identified.</Text>;
                      }

                      return (
                        <View style={styles.typeGrid}>
                          {sortedWeaknesses.map(([tName, count]) => (
                            <View key={tName} style={[styles.matchupBadge, { backgroundColor: getTypeColor(tName) }]}>
                              <Text style={styles.matchupBadgeText}>{tName.toUpperCase()}</Text>
                              <Text style={styles.multiplierTag}>{count} Weak</Text>
                            </View>
                          ))}
                        </View>
                      );
                    })()}
                  </View>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8FAFC' },
  topHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 10, marginBottom: 8 },
  appTitle: { fontSize: 26, fontWeight: '900', color: '#0F172A' },
  favHeaderBtn: { backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' },
  favHeaderBtnActive: { backgroundColor: '#FEE2E2', borderColor: '#FCA5A5' },
  shinyActiveBtn: { backgroundColor: '#FEF3C7', borderColor: '#FCD34D' },
  teamActiveBtn: { backgroundColor: '#E0F2FE', borderColor: '#7DD3FC' },
  favHeaderBtnText: { fontSize: 12, fontWeight: '700', color: '#334155' },
  searchBar: { backgroundColor: '#FFF', marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, fontSize: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 8 },
  scrollSection: { marginBottom: 8 },
  genScrollContent: { paddingHorizontal: 16, gap: 8 },
  genPill: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10, backgroundColor: '#E2E8F0' },
  genPillActive: { backgroundColor: '#0284C7' },
  genPillText: { fontSize: 12, fontWeight: '700', color: '#475569' },
  genPillTextActive: { color: '#FFF' },
  typeScrollContent: { paddingHorizontal: 16, gap: 6 },
  typePill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, opacity: 0.75 },
  typePillActive: { opacity: 1, transform: [{ scale: 1.05 }] },
  typePillText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  listContent: { paddingHorizontal: 10, paddingBottom: 24 },
  gridRow: { justifyContent: 'space-between' },
  card: { flex: 1, backgroundColor: '#FFF', margin: 6, padding: 12, borderRadius: 16, alignItems: 'center', borderWidth: 2, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', alignItems: 'center' },
  pokeId: { fontSize: 11, fontWeight: 'bold', color: '#94A3B8' },
  cardFavIcon: { fontSize: 14 },
  sprite: { width: 90, height: 90, marginVertical: 4 },
  pokeName: { fontSize: 14, fontWeight: 'bold', color: '#1E293B' },
  typesRow: { flexDirection: 'row', gap: 4, marginTop: 4 },
  typeBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, fontSize: 9, fontWeight: 'bold', color: '#FFF' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20 },
  loadingText: { marginTop: 10, color: '#64748B', fontSize: 14 },
  emptyTitle: { fontSize: 16, fontWeight: 'bold', color: '#334155' },
  emptySubtitle: { fontSize: 13, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.55)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#FFF', borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36, maxHeight: '90%' },
  modalControlBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  modalFavBtn: { backgroundColor: '#F8FAFC', paddingHorizontal: 8, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  modalFavBtnText: { fontSize: 11, fontWeight: '700', color: '#334155' },
  closeBtn: { backgroundColor: '#F1F5F9', width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: 'bold', color: '#64748B' },
  modalHero: { alignItems: 'center', marginTop: 4 },
  modalId: { fontSize: 13, fontWeight: '700', color: '#94A3B8' },
  modalTitle: { fontSize: 24, fontWeight: '800', color: '#0F172A', marginTop: 2 },
  modalTypesRow: { flexDirection: 'row', gap: 8, marginTop: 6, alignSelf: 'center' },
  modalTypeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, fontSize: 11, fontWeight: 'bold', color: '#FFF' },
  modalSprite: { width: 140, height: 140, alignSelf: 'center', marginVertical: 6, resizeMode: 'contain' },
  voiceButton: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, elevation: 2 },
  voiceButtonText: { color: '#FFF', fontSize: 12, fontWeight: 'bold' },
  tabContainer: { flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 12, padding: 4, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 8 },
  tabBtnActive: { backgroundColor: '#FFF', elevation: 1 },
  tabBtnText: { fontSize: 11, fontWeight: '700', color: '#64748B' },
  tabBtnTextActive: { color: '#0F172A' },
  dimensionsCard: { flexDirection: 'row', backgroundColor: '#F8FAFC', borderRadius: 14, paddingVertical: 12, justifyContent: 'space-around', alignItems: 'center', marginBottom: 16, borderWidth: 1, borderColor: '#E2E8F0' },
  dimensionItem: { alignItems: 'center', flex: 1 },
  dimensionLabel: { fontSize: 11, color: '#64748B', marginBottom: 2, fontWeight: '600' },
  dimensionValue: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  dimensionDivider: { width: 1, height: 24, backgroundColor: '#CBD5E1' },
  sectionHeader: { fontSize: 14, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  abilitiesList: { gap: 8, marginBottom: 16 },
  abilityCard: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#E2E8F0' },
  abilityHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  abilityTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  hiddenTagBadge: { fontSize: 10, fontWeight: '700', color: '#E11D48', backgroundColor: '#FFE4E6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  abilityDescText: { fontSize: 12, color: '#475569', lineHeight: 17 },
  statsContainer: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
  statRow: { flexDirection: 'row', alignItems: 'center', marginVertical: 4 },
  statNameLabel: { width: 65, fontSize: 11, fontWeight: '700', color: '#64748B' },
  statValueLabel: { width: 32, fontSize: 12, fontWeight: 'bold', color: '#1E293B', textAlign: 'right', marginRight: 10 },
  diffLabel: { marginLeft: 'auto', fontSize: 12, fontWeight: '800' },
  statBarBackground: { flex: 1, height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, overflow: 'hidden' },
  statBarFill: { height: '100%', borderRadius: 4 },
  evoChainWrapper: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  evoDetailItem: { alignItems: 'center', marginVertical: 4 },
  evoRequirementBox: { alignItems: 'center', marginVertical: 6 },
  evoArrowText: { fontSize: 16, color: '#94A3B8', fontWeight: 'bold' },
  evoRequirementBadge: { backgroundColor: '#E0F2FE', color: '#0284C7', fontSize: 11, fontWeight: '700', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginTop: 2 },
  evoNodeCard: { alignItems: 'center', backgroundColor: '#FFF', padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', width: 140 },
  evoSpriteLarge: { width: 75, height: 75 },
  evoNodeName: { fontSize: 13, fontWeight: 'bold', color: '#1E293B', marginTop: 4 },
  evoNodeId: { fontSize: 10, color: '#94A3B8', fontWeight: '600' },
  megaCard: { backgroundColor: '#F8FAFC', borderRadius: 16, padding: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 16 },
  megaFormTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', textAlign: 'center', marginBottom: 6 },
  megaSprite: { width: 120, height: 120, alignSelf: 'center', marginVertical: 8 },
  noMegaBox: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 24, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', marginVertical: 10 },
  noMegaTitle: { fontSize: 15, fontWeight: '700', color: '#334155' },
  noMegaDesc: { fontSize: 12, color: '#94A3B8', textAlign: 'center', marginTop: 4 },
  typeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  matchupBadge: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, gap: 4 },
  matchupBadgeText: { fontSize: 10, fontWeight: 'bold', color: '#FFF' },
  multiplierTag: { backgroundColor: 'rgba(0,0,0,0.25)', paddingHorizontal: 4, paddingVertical: 1, borderRadius: 4, fontSize: 9, fontWeight: 'bold', color: '#FFF' },
  neutralText: { fontSize: 12, color: '#94A3B8', fontStyle: 'italic' },
  movesContainer: { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 8, borderWidth: 1, borderColor: '#E2E8F0' },
  moveRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#E2E8F0' },
  moveName: { fontSize: 13, fontWeight: '700', color: '#1E293B' },
  moveLearnMethod: { fontSize: 11, color: '#64748B', marginTop: 2 },
  moveLearnTag: { fontSize: 10, fontWeight: 'bold', color: '#0284C7', backgroundColor: '#E0F2FE', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  calcCard: { backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14 },
  calcTitle: { fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 8 },
  smallPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, backgroundColor: '#E2E8F0' },
  smallPillActive: { backgroundColor: '#0284C7' },
  smallPillText: { fontSize: 11, fontWeight: '600', color: '#475569' },
  smallPillTextActive: { color: '#FFF' },
  teamMemberCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 10, alignItems: 'center', width: 95, borderWidth: 1, borderColor: '#E2E8F0' },
  teamTabPill: { backgroundColor: '#E2E8F0', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 },
  teamTabPillActive: { backgroundColor: '#0284C7' },
  teamTabPillText: { fontSize: 12, fontWeight: 'bold', color: '#475569' },
  teamTabPillTextActive: { color: '#FFF' },
  newTeamBtn: { backgroundColor: '#DCFCE7', borderColor: '#86EFAC', borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 },
  newTeamBtnText: { fontSize: 12, fontWeight: 'bold', color: '#16A34A' },
});

export function CharacterLevelCalculator(experience) {
    return Math.floor(experience / 1000) + 1;
}

export function CharacterDiceConverter(inputNum) {
    switch(inputNum) {
        case 1:
            return "d4"
        case 2:
            return "d6"
        case 3:
            return "d8"
        case 4:
            return "d10"
        case 5:
            return "d12"
        case 6:
            return "d20"
        default:
            return "N/A"
    }
}

export function reverseCharacterDiceConverter(inputString) {
    switch(inputString) {
        case "d4":
            return 1
        case "d6":
            return 2
        case "d8":
            return 3
        case "d10":
            return 4
        case "d12":
            return 5
        case "d20":
            return 6
        default:
            return 0
    }
}

export function CharacterStatCalculator(experience, baseArmorClass, baseHitModifier, baseDamageModifier, baseDamageDice, baseDamageDiceType, baseHealingDiceType) {
    const level = CharacterLevelCalculator(experience);
    const baseClassDifficultyClass = 14;
    const baseHealingDice = 1;
    const baseHealingModifier = 2;
    const baseAttuneRelics = 2;

    switch(level) {
        case 1:
            return {
                ArmorClass: baseArmorClass,
                HitModifier: baseHitModifier,
                DamageModifier: baseDamageModifier,
                DamageDice: baseDamageDice,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier,
                HealingDice: baseHealingDice,
                HealingDiceType: baseHealingDiceType,
                ClassDifficultyClass: baseClassDifficultyClass,
                AttuneRelics: baseAttuneRelics
            };
        case 2:
            return {
                ArmorClass: baseArmorClass,
                HitModifier: baseHitModifier + 1,
                DamageModifier: baseDamageModifier,
                DamageDice: baseDamageDice,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier,
                HealingDice: baseHealingDice,
                HealingDiceType: baseHealingDiceType,
                ClassDifficultyClass: baseClassDifficultyClass + 1,
                AttuneRelics: baseAttuneRelics
            };
        case 3:
            return {
                ArmorClass: baseArmorClass,
                HitModifier: baseHitModifier + 1,
                DamageModifier: baseDamageModifier + 2,
                DamageDice: baseDamageDice,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier + 2,
                HealingDice: baseHealingDice + 1,
                HealingDiceType: baseHealingDiceType,
                ClassDifficultyClass: baseClassDifficultyClass + 1,
                AttuneRelics: baseAttuneRelics
            };
        case 4:
            return {
                ArmorClass: baseArmorClass + 1,
                HitModifier: baseHitModifier + 1,
                DamageModifier: baseDamageModifier + 2,
                DamageDice: baseDamageDice,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier + 2,
                HealingDice: baseHealingDice + 1,
                HealingDiceType: baseHealingDiceType,
                ClassDifficultyClass: baseClassDifficultyClass + 1,
                AttuneRelics: baseAttuneRelics
            };
        case 5:
            return {
                ArmorClass: baseArmorClass + 1,
                HitModifier: baseHitModifier + 1,
                DamageModifier: baseDamageModifier + 2,
                DamageDice: baseDamageDice + 1,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier + 2,
                HealingDice: baseHealingDice + 1,
                HealingDiceType: baseHealingDiceType + 1,
                ClassDifficultyClass: baseClassDifficultyClass + 1,
                AttuneRelics: baseAttuneRelics
            };
        case 6:
            return {
                ArmorClass: baseArmorClass + 1,
                HitModifier: baseHitModifier + 2,
                DamageModifier: baseDamageModifier + 2,
                DamageDice: baseDamageDice + 1,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier + 2,
                HealingDice: baseHealingDice + 1,
                HealingDiceType: baseHealingDiceType + 1,
                ClassDifficultyClass: baseClassDifficultyClass + 2,
                AttuneRelics: baseAttuneRelics + 1
            };
        case 7:
            return {
                ArmorClass: baseArmorClass + 1,
                HitModifier: baseHitModifier + 2,
                DamageModifier: baseDamageModifier + 4,
                DamageDice: baseDamageDice + 1,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier + 4,
                HealingDice: baseHealingDice + 2,
                HealingDiceType: baseHealingDiceType + 1,
                ClassDifficultyClass: baseClassDifficultyClass + 2,
                AttuneRelics: baseAttuneRelics + 1
            };
        case 8:
            return {
                ArmorClass: baseArmorClass + 1,
                HitModifier: baseHitModifier + 2,
                DamageModifier: baseDamageModifier + 4,
                DamageDice: baseDamageDice + 1,
                DamageDiceType: baseDamageDiceType,
                HealingModifier: baseHealingModifier + 4,
                HealingDice: baseHealingDice + 2,
                HealingDiceType: baseHealingDiceType + 1,
                ClassDifficultyClass: baseClassDifficultyClass + 2,
                AttuneRelics: baseAttuneRelics + 1
            };
        case 9:
            return {
                ArmorClass: baseArmorClass + 2,
                HitModifier: baseHitModifier + 2,
                DamageModifier: baseDamageModifier + 5,
                DamageDice: baseDamageDice + 1,
                DamageDiceType: baseDamageDiceType + 1,
                HealingModifier: baseHealingModifier + 5,
                HealingDice: baseHealingDice + 2,
                HealingDiceType: baseHealingDiceType + 2,
                ClassDifficultyClass: baseClassDifficultyClass + 2,
                AttuneRelics: baseAttuneRelics + 1
            };
        case 10:
            return {
                ArmorClass: baseArmorClass + 2,
                HitModifier: baseHitModifier + 2,
                DamageModifier: baseDamageModifier + 5,
                DamageDice: baseDamageDice + 2,
                DamageDiceType: baseDamageDiceType + 1,
                HealingModifier: baseHealingModifier + 5,
                HealingDice: baseHealingDice + 2,
                HealingDiceType: baseHealingDiceType + 2,
                ClassDifficultyClass: baseClassDifficultyClass + 2,
                AttuneRelics: baseAttuneRelics + 1
            };
        case 11:
            return {
                ArmorClass: baseArmorClass + 2,
                HitModifier: baseHitModifier + 3,
                DamageModifier: baseDamageModifier + 5,
                DamageDice: baseDamageDice + 2,
                DamageDiceType: baseDamageDiceType + 1,
                HealingModifier: baseHealingModifier + 5,
                HealingDice: baseHealingDice + 2,
                HealingDiceType: baseHealingDiceType + 2,
                ClassDifficultyClass: baseClassDifficultyClass + 3,
                AttuneRelics: baseAttuneRelics + 2
            };
        case 12:
            return {
                ArmorClass: baseArmorClass + 2,
                HitModifier: baseHitModifier + 3,
                DamageModifier: baseDamageModifier + 7,
                DamageDice: baseDamageDice + 2,
                DamageDiceType: baseDamageDiceType + 1,
                HealingModifier: baseHealingModifier + 7,
                HealingDice: baseHealingDice + 3,
                HealingDiceType: baseHealingDiceType + 2,
                ClassDifficultyClass: baseClassDifficultyClass + 3,
                AttuneRelics: baseAttuneRelics + 2
            };
        case 13:
            return {
                ArmorClass: baseArmorClass + 2,
                HitModifier: baseHitModifier + 3,
                DamageModifier: baseDamageModifier + 7,
                DamageDice: baseDamageDice + 2,
                DamageDiceType: baseDamageDiceType + 1,
                HealingModifier: baseHealingModifier + 7,
                HealingDice: baseHealingDice + 3,
                HealingDiceType: baseHealingDiceType + 2,
                ClassDifficultyClass: baseClassDifficultyClass + 3,
                AttuneRelics: baseAttuneRelics + 2
            };
        case 14:
            return {
                ArmorClass: baseArmorClass + 3,
                HitModifier: baseHitModifier + 3,
                DamageModifier: baseDamageModifier + 8,
                DamageDice: baseDamageDice + 2,
                DamageDiceType: baseDamageDiceType + 2,
                HealingModifier: baseHealingModifier + 8,
                HealingDice: baseHealingDice + 3,
                HealingDiceType: baseHealingDiceType + 2,
                ClassDifficultyClass: baseClassDifficultyClass + 3,
                AttuneRelics: baseAttuneRelics + 2
            };
        case 15:
            return {
                ArmorClass: baseArmorClass + 3,
                HitModifier: baseHitModifier + 4,
                DamageModifier: baseDamageModifier + 8,
                DamageDice: baseDamageDice + 3,
                DamageDiceType: baseDamageDiceType + 2,
                HealingModifier: baseHealingModifier + 8,
                HealingDice: baseHealingDice + 3,
                HealingDiceType: baseHealingDiceType + 3,
                ClassDifficultyClass: baseClassDifficultyClass + 4,
                AttuneRelics: baseAttuneRelics + 2
            };
        default:
            return {
                ArmorClass: baseArmorClass + 3,
                HitModifier: baseHitModifier + 4,
                DamageModifier: baseDamageModifier + 8,
                DamageDice: baseDamageDice + 3,
                DamageDiceType: baseDamageDiceType + 2,
                HealingModifier: baseHealingModifier + 8,
                HealingDice: baseHealingDice + 3,
                HealingDiceType: baseHealingDiceType + 3,
                ClassDifficultyClass: baseClassDifficultyClass + 4,
                AttuneRelics: baseAttuneRelics + 2
            };
    }
}
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * version v37
 * @title Addresses
 * @dev ЕДИНСТВЕН ФАЙЛ С ВСИЧКИ АДРЕСИ
 * Използва се И от Solidity И от JavaScript
 * 
 * За промяна на адреси - редактирай САМО ТОЗИ ФАЙЛ!
 */

library Addresses {
    // ===================================================
    // BSC TESTNET (chainId: 97)
    // ===================================================
    address internal constant TESTNET_DEV = 0xCBfA2d3612b7474fF89c0746Ea6bAEee06A61702;
    address internal constant TESTNET_MARKETING = 0x67eDbe18Ad6AB1ff0D57CCc511F56485EfFcabE7;
    address internal constant TESTNET_TEAM = 0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6;
    address internal constant TESTNET_ADVISOR = 0xD1a7281FB1D1745C29Dfed9C1Af22b67a7403Dd6;
    address internal constant TESTNET_ROUTER = 0xD99D1c33F9fC3444f8101754aBC46c52416550D1;
    address internal constant TESTNET_FACTORY = 0x6725F303b657a9451d8BA641348b6761A6CC7a17;
    address internal constant TESTNET_WBNB = 0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd;
    
    // ===================================================
    // BSC MAINNET (chainId: 56)
    // ===================================================
    address internal constant MAINNET_DEV = 0x567c1c5e9026E04078F9b92DcF295A58355f60c7;
    address internal constant MAINNET_MARKETING = 0x58ec63d31b8e4D6624B5c88338027a54Be1AE28A;
    address internal constant MAINNET_TEAM = 0x6300811567bed7d69B5AC271060a7E298f99fddd;
    address internal constant MAINNET_ADVISOR = 0x8d95d56436Eb58ee3f9209e8cc4BfD59cfBE8b87;
    address internal constant MAINNET_ROUTER = 0x10ED43C718714eb63d5aA57B78B54704E256024E;
    address internal constant MAINNET_FACTORY = 0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73;
    address internal constant MAINNET_WBNB = 0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c;
}